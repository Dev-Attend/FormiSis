import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { canManageProposal, canViewProposal } from "@/lib/proposalPersistence";
import { blocos } from "@/lib/formSchema";
import { canTransition, type ProposalStatus } from "@/lib/proposalWorkflow";
import { avaliarRegras } from "@/lib/rulesEngine";
import {
  applyPreSalesMeta,
  canCommercialEditStage,
  isChecklistComplete,
  parsePreSalesMeta,
  type PreSalesBlockComments,
  type PreSalesChecklist,
} from "@/lib/preSalesMeta";

type PreSalesAction = "SUBMIT_FOR_PRE_SALES" | "APPROVE_TECHNICAL" | "REQUEST_CHANGES";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, [
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const session = await db.formSession.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  if (!session) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  if (!canViewProposal(auth.user.role, session.createdById, auth.user.id)) {
    return NextResponse.json({ error: "Sem permissao para visualizar esta proposta." }, { status: 403 });
  }

  return NextResponse.json({ session });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["ADMIN", "COMERCIAL", "PRE_VENDAS"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    clientName?: string;
    opportunityRef?: string;
    payload?: Record<string, string>;
    warnings?: string[];
    status?: ProposalStatus;
    finalDocument?: string | null;
    expectedRevision?: number;
    transitionNote?: string;
    preSalesAction?: PreSalesAction;
    preSalesChecklist?: Partial<PreSalesChecklist>;
    preSalesBlockComments?: PreSalesBlockComments;
    preSalesComment?: string;
  };

  const session = await db.formSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  if (!canManageProposal(auth.user.role, session.createdById, auth.user.id)) {
    return NextResponse.json({ error: "Sem permissao para alterar esta proposta." }, { status: 403 });
  }

  if (body.expectedRevision === undefined) {
    return NextResponse.json(
      { error: "expectedRevision obrigatório para salvar alterações.", currentRevision: session.revision },
      { status: 400 },
    );
  }
  if (body.expectedRevision !== session.revision) {
    return NextResponse.json(
      {
        error: "Conflito de versao: a proposta foi alterada em outro lugar. Recarregue e tente novamente.",
        currentRevision: session.revision,
      },
      { status: 409 },
    );
  }

  const currentPayloadObj = JSON.parse(session.payloadJson || "{}") as Record<string, string>;
  let nextPayloadObj = body.payload ? { ...body.payload } : { ...currentPayloadObj };
  let meta = parsePreSalesMeta(nextPayloadObj);

  const isReviewer = auth.user.role === "PRE_VENDAS" || auth.user.role === "ADMIN";
  const action = body.preSalesAction;
  const comment = body.preSalesComment?.trim() || undefined;
  const mergedBlockComments: PreSalesBlockComments = {
    ...meta.blockComments,
    ...(body.preSalesBlockComments ?? {}),
  };
  for (const [k, v] of Object.entries(mergedBlockComments)) {
    if (!v?.trim()) delete mergedBlockComments[k];
    else mergedBlockComments[k] = v.trim();
  }
  meta = { ...meta, blockComments: mergedBlockComments };

  if (!action && auth.user.role === "COMERCIAL" && !canCommercialEditStage(meta.stage)) {
    return NextResponse.json(
      {
        error:
          "Proposta na fila do pre-vendas. Aguarde parecer ou ajuste solicitado antes de editar.",
      },
      { status: 403 },
    );
  }

  let forcedStatus: ProposalStatus | undefined;
  if (action === "SUBMIT_FOR_PRE_SALES") {
    if (!(auth.user.role === "COMERCIAL" || auth.user.role === "ADMIN")) {
      return NextResponse.json({ error: "Apenas Comercial/Admin pode enviar para pre-vendas." }, { status: 403 });
    }
    if (meta.stage === "UNDER_PRE_SALES_REVIEW") {
      return NextResponse.json({ error: "Proposta ja esta na fila do pre-vendas." }, { status: 400 });
    }
    const payloadForValidation = body.payload ? { ...body.payload } : { ...nextPayloadObj };
    const rules = avaliarRegras(payloadForValidation);
    const requiredBySchema = blocos
      .filter((b) => rules.visibleBlocks.has(b.id))
      .flatMap((b) => b.fields)
      .filter((f) => f.required)
      .map((f) => f.id);
    const requiredByRules = Array.from(rules.requiredFields);
    const allRequired = new Set([...requiredBySchema, ...requiredByRules]);
    const missingRequired = Array.from(allRequired).filter(
      (fieldId) => !String(payloadForValidation[fieldId] ?? "").trim(),
    );
    if (missingRequired.length > 0) {
      return NextResponse.json(
        {
          error:
            "Preencha todos os campos obrigatórios antes de enviar para a fila do pré-vendas.",
          missingRequiredFields: missingRequired,
          missingRequiredCount: missingRequired.length,
        },
        { status: 400 },
      );
    }
    meta = {
      ...meta,
      stage: "UNDER_PRE_SALES_REVIEW",
      submittedById: auth.user.id,
      submittedAt: new Date().toISOString(),
      lastComment: comment ?? meta.lastComment,
    };
    forcedStatus = "PAUSED";
  }

  if (action === "REQUEST_CHANGES") {
    if (!isReviewer) {
      return NextResponse.json({ error: "Apenas pre-vendas/admin pode devolver para ajustes." }, { status: 403 });
    }
    if (meta.stage !== "UNDER_PRE_SALES_REVIEW") {
      return NextResponse.json({ error: "A proposta não está na etapa da fila do pré-vendas." }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ error: "Informe o parecer técnico ao solicitar ajustes." }, { status: 400 });
    }
    meta = {
      ...meta,
      checklist: { ...meta.checklist, ...(body.preSalesChecklist ?? {}) },
      stage: "CHANGES_REQUESTED",
      lastDecision: "CHANGES_REQUESTED",
      lastDecisionAt: new Date().toISOString(),
      lastDecisionByRole: auth.user.role === "ADMIN" ? "ADMIN" : "PRE_VENDAS",
      lastComment: comment,
    };
    forcedStatus = "IN_PROGRESS";
  }

  if (action === "APPROVE_TECHNICAL") {
    if (!isReviewer) {
      return NextResponse.json({ error: "Apenas pre-vendas/admin pode aprovar tecnicamente." }, { status: 403 });
    }
    if (meta.stage !== "UNDER_PRE_SALES_REVIEW") {
      return NextResponse.json({ error: "A proposta não está na etapa da fila do pré-vendas." }, { status: 400 });
    }
    const mergedChecklist = { ...meta.checklist, ...(body.preSalesChecklist ?? {}) };
    if (!isChecklistComplete(mergedChecklist)) {
      return NextResponse.json(
        { error: "Checklist técnico incompleto. Valide a proposta como um todo antes de aprovar." },
        { status: 400 },
      );
    }
    if (!comment) {
      return NextResponse.json({ error: "Parecer técnico obrigatório para aprovar." }, { status: 400 });
    }
    meta = {
      ...meta,
      checklist: mergedChecklist,
      stage: "APPROVED_PRE_SALES",
      lastDecision: "APPROVED",
      lastDecisionAt: new Date().toISOString(),
      lastDecisionByRole: auth.user.role === "ADMIN" ? "ADMIN" : "PRE_VENDAS",
      lastComment: comment,
    };
    forcedStatus = "IN_PROGRESS";
  }

  nextPayloadObj = applyPreSalesMeta(nextPayloadObj, meta);

  const nextStatus = (forcedStatus ?? body.status ?? session.status) as ProposalStatus;
  if (nextStatus !== session.status) {
    const gate = canTransition(session.status as ProposalStatus, nextStatus, auth.user.role);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 400 });
    }
  }

  const nextTitle = body.title?.trim() ?? session.title;
  const nextClient = body.clientName !== undefined ? body.clientName?.trim() || null : session.clientName;
  const nextOpp =
    body.opportunityRef !== undefined ? body.opportunityRef?.trim() || null : session.opportunityRef;
  const nextPayload = JSON.stringify(nextPayloadObj);
  const nextWarnings = body.warnings ? JSON.stringify(body.warnings) : session.warningsJson;
  const nextFinalDoc = body.finalDocument !== undefined ? body.finalDocument : session.finalDocument;

  const hasChanges =
    nextTitle !== session.title ||
    nextClient !== session.clientName ||
    nextOpp !== session.opportunityRef ||
    nextPayload !== session.payloadJson ||
    nextWarnings !== session.warningsJson ||
    nextStatus !== session.status ||
    (nextFinalDoc ?? null) !== (session.finalDocument ?? null);

  if (!hasChanges) {
    return NextResponse.json({ ok: true, revision: session.revision, status: session.status });
  }

  const shouldFinalize = nextStatus === "FINALIZED" && session.status !== "FINALIZED";

  const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const revision = session.revision + 1;
    const row = await tx.formSession.update({
      where: { id },
      data: {
        title: nextTitle,
        clientName: nextClient,
        opportunityRef: nextOpp,
        payloadJson: nextPayload,
        warningsJson: nextWarnings,
        status: nextStatus,
        finalDocument: nextFinalDoc,
        revision,
        finalizedAt: shouldFinalize ? new Date() : session.finalizedAt,
      },
    });

    await tx.proposalRevision.create({
      data: {
        formSessionId: row.id,
        status: row.status,
        payloadJson: row.payloadJson,
        warningsJson: row.warningsJson,
        note:
          body.transitionNote ??
          (action
            ? `PreSales:${action}`
            : nextStatus !== session.status
              ? `Status ${session.status} -> ${nextStatus}`
              : "Atualizacao"),
        createdById: auth.user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        action: action ? `PRE_SALES_${action}` : "PROPOSAL_UPDATED",
        resourceType: "FormSession",
        resourceId: row.id,
        formSessionId: row.id,
        detailsJson: JSON.stringify({
          fromStatus: session.status,
          toStatus: row.status,
          revision: row.revision,
          preSalesStage: meta.stage,
          preSalesComment: comment,
          fields: {
            title: nextTitle !== session.title,
            client: nextClient !== session.clientName,
            opportunity: nextOpp !== session.opportunityRef,
            payload: nextPayload !== session.payloadJson,
            status: nextStatus !== session.status,
          },
        }),
        userId: auth.user.id,
      },
    });

    return row;
  });

  return NextResponse.json({
    ok: true,
    revision: updated.revision,
    status: updated.status,
    preSalesStage: meta.stage,
  });
}
