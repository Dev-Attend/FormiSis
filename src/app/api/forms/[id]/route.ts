import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { canManageProposal, canViewProposal } from "@/lib/proposalPersistence";
import { blocos } from "@/lib/formSchema";
import { mapTenantBlocksToFormBlocks } from "@/lib/formSchemaAdapter";
import { loadTenantFormSchemaByCompanyId } from "@/lib/formSchemaService";
import { canTransition, type ProposalStatus } from "@/lib/proposalWorkflow";
import { listMissingMappedEvidence, listMissingMappedFieldIds } from "@/lib/preSalesValidationMap";
import {
  avaliarRegras,
  listMissingRequiredFields,
  PRE_SALES_INTERNAL_BLOCK_ID,
} from "@/lib/rulesEngine";
import {
  applyPreSalesMeta,
  canCommercialEditStage,
  isChecklistComplete,
  parsePreSalesMeta,
  type PreSalesBlockComments,
  type PreSalesChecklist,
} from "@/lib/preSalesMeta";

type PreSalesAction = "SUBMIT_FOR_PRE_SALES" | "APPROVE_TECHNICAL" | "REQUEST_CHANGES";

function getVisibleFieldIds(
  payload: Record<string, string>,
  schemaBlocks: typeof blocos,
  opts?: { includePreSalesInternalBlock?: boolean },
) {
  const rules = avaliarRegras(payload);
  const blockIds = new Set(
    schemaBlocks.filter((b) => rules.visibleBlocks.has(b.id)).map((b) => b.id),
  );
  if (opts?.includePreSalesInternalBlock) {
    blockIds.add(PRE_SALES_INTERNAL_BLOCK_ID);
  }
  return new Set(
    schemaBlocks.filter((b) => blockIds.has(b.id)).flatMap((b) => b.fields.map((f) => f.id)),
  );
}

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
    preSalesRequestedFieldIds?: string[];
  };

  const session = await db.formSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
  }

  if (!canManageProposal(auth.user.role, session.createdById, auth.user.id)) {
    return NextResponse.json({ error: "Sem permissao para alterar esta proposta." }, { status: 403 });
  }

  const owner = await db.user.findUnique({
    where: { id: session.createdById },
    select: { companyId: true },
  });
  const schemaCompanyId = owner?.companyId ?? auth.user.companyId;
  let schemaBlocks = blocos;
  if (schemaCompanyId) {
    const tenantSchema = await loadTenantFormSchemaByCompanyId(schemaCompanyId);
    if (tenantSchema?.blocks.length) {
      schemaBlocks = mapTenantBlocksToFormBlocks(tenantSchema.blocks);
    } else if (tenantSchema && tenantSchema.blocks.length === 0) {
      return NextResponse.json(
        { error: "Empresa sem blocos ativos de formulario." },
        { status: 400 },
      );
    }
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

  if (!action && isReviewer && body.preSalesChecklist) {
    meta = {
      ...meta,
      checklist: { ...meta.checklist, ...body.preSalesChecklist },
    };
  }

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
    const missingRequired = listMissingRequiredFields(payloadForValidation, {
      excludeBlockIds: [PRE_SALES_INTERNAL_BLOCK_ID],
      schemaBlocks,
    });
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
    const visibleFieldIds = getVisibleFieldIds(payloadForValidation, schemaBlocks);
    const missingMappedForSubmit = listMissingMappedFieldIds(payloadForValidation, visibleFieldIds);
    if (missingMappedForSubmit.length > 0) {
      return NextResponse.json(
        {
          error:
            "Preencha todos os itens técnicos mínimos antes de enviar para a fila do pré-vendas.",
          missingMappedFieldIds: missingMappedForSubmit,
          missingMappedCount: missingMappedForSubmit.length,
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
    const requestedFromRequired = listMissingRequiredFields(nextPayloadObj, {
      excludeBlockIds: [PRE_SALES_INTERNAL_BLOCK_ID],
      schemaBlocks,
    });
    const visibleFieldIds = getVisibleFieldIds(nextPayloadObj, schemaBlocks);
    const requestedFromMapped = listMissingMappedFieldIds(nextPayloadObj, visibleFieldIds);
    const requestedFieldIds =
      body.preSalesRequestedFieldIds && body.preSalesRequestedFieldIds.length > 0
        ? Array.from(new Set(body.preSalesRequestedFieldIds.filter((x) => typeof x === "string" && x.trim().length > 0)))
        : Array.from(new Set([...requestedFromRequired, ...requestedFromMapped]));
    meta = {
      ...meta,
      checklist: { ...meta.checklist, ...(body.preSalesChecklist ?? {}) },
      stage: "CHANGES_REQUESTED",
      requestedFieldIds,
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
    const missingReqApprove = listMissingRequiredFields(nextPayloadObj, {
      extraRequiredBlockIds: [PRE_SALES_INTERNAL_BLOCK_ID],
      schemaBlocks,
    });
    if (missingReqApprove.length > 0) {
      return NextResponse.json(
        {
          error:
            "Não é possível aprovar tecnicamente: ainda há campos obrigatórios vazios conforme as regras do formulário.",
          missingRequiredFields: missingReqApprove,
          missingRequiredCount: missingReqApprove.length,
        },
        { status: 400 },
      );
    }
    const visibleFieldIds = getVisibleFieldIds(nextPayloadObj, schemaBlocks, {
      includePreSalesInternalBlock: true,
    });
    const missingMappedApprove = listMissingMappedEvidence(nextPayloadObj, visibleFieldIds);
    if (missingMappedApprove.length > 0) {
      return NextResponse.json(
        {
          error:
            "Não é possível aprovar tecnicamente: ainda há itens do quadro técnico sem resposta no formulário.",
          missingMappedCount: missingMappedApprove.length,
        },
        { status: 400 },
      );
    }
    meta = {
      ...meta,
      checklist: mergedChecklist,
      stage: "APPROVED_PRE_SALES",
      requestedFieldIds: [],
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
