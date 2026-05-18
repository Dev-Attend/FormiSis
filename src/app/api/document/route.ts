import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { blocos } from "@/lib/formSchema";
import { mapTenantBlocksToFormBlocks } from "@/lib/formSchemaAdapter";
import { loadTenantFormSchemaByCompanyId } from "@/lib/formSchemaService";
import { generateTechnicalPdf } from "@/lib/generateTechnicalPdf";
import { avaliarRegras } from "@/lib/rulesEngine";
import { requireApiAccess } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { canManageProposal } from "@/lib/proposalPersistence";
import { canTransition, type ProposalStatus } from "@/lib/proposalWorkflow";
import { parsePreSalesMeta } from "@/lib/preSalesMeta";

function flatLines(
  data: Record<string, string>,
  warnings: string[],
  errors: string[],
  schemaBlocks: typeof blocos,
) {
  const lines: string[] = [];
  lines.push("DOCUMENTO TECNICO AUTOMATICO - FORMSIS");
  lines.push("");
  lines.push("VALIDACOES E REGRAS");
  warnings.forEach((w) => lines.push(`ALERTA: ${w}`));
  errors.forEach((e) => lines.push(`ERRO: ${e}`));
  lines.push("");
  lines.push("RESPOSTAS DO FORMULARIO (POR BLOCO)");
  schemaBlocks.forEach((bloco) => {
    lines.push("");
    lines.push(bloco.title);
    bloco.fields.forEach((field) => {
      lines.push(`- ${field.label}: ${data[field.id] || "-"}`);
    });
  });
  return lines;
}

async function generateDocx(lines: string[]) {
  const doc = new Document({
    sections: [
      {
        children: lines.map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line })],
            }),
        ),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAccess(request, ["ADMIN", "COMERCIAL", "PRE_VENDAS"]);
  if (!auth.ok) return auth.response;

  const rl = enforceRateLimit(`doc:${auth.user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Limite de requisicoes excedido.", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec ?? 60) } },
    );
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisicao nao e JSON valido." }, { status: 400 });
    }
    const body = rawBody as {
      data?: Record<string, string>;
      sessionId?: string;
      expectedRevision?: number;
    };
    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "Payload invalido: e obrigatorio enviar data (objeto)." }, { status: 400 });
    }
    const formData = body.data;

  const resolveSchemaBlocks = async (companyId?: string | null) => {
    if (!companyId) return blocos;
    const tenantSchema = await loadTenantFormSchemaByCompanyId(companyId, auth.user.id);
    if (!tenantSchema) return blocos;
    if (tenantSchema.blocks.length === 0) return [] as typeof blocos;
    return mapTenantBlocksToFormBlocks(tenantSchema.blocks);
  };

  if (!auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
      { status: 409 },
    );
  }

  let schemaBlocks = await resolveSchemaBlocks(auth.user.activeCompanyId);
  if (schemaBlocks.length === 0) {
    return NextResponse.json(
      { error: "Empresa sem blocos ativos de formulario." },
      { status: 400 },
    );
  }

  const outputFormat = formData._output_format === "pdf" ? "pdf" : "docx";
  let rules = avaliarRegras(formData);
  let requiredBySchema = schemaBlocks
    .filter((b) => rules.visibleBlocks.has(b.id))
    .flatMap((b) => b.fields)
    .filter((f) => f.required)
    .map((f) => f.id);
  let schemaFieldIds = new Set(
    schemaBlocks.flatMap((b) => b.fields.map((f) => f.id)),
  );
  let requiredByRules = Array.from(rules.requiredFields).filter((fieldId) =>
    schemaFieldIds.has(fieldId),
  );
  let allRequired = new Set([...requiredBySchema, ...requiredByRules]);
  let missing = Array.from(allRequired).filter(
    (fieldId) => !String(formData[fieldId] ?? "").trim(),
  );
  let allErrors = [...rules.errors, ...missing.map((f) => `Campo obrigatório não preenchido: ${f}`)];

  let proposalSession: {
    id: string;
    revision: number;
    status: string;
    createdById: string;
  } | null = null;
  /** Proposta ja encerrada: apenas gera documento, sem re-finalizar nem bloquear por regras do fluxo. */
  let skipFinalizeAndRuleBlock = false;

  if (body.sessionId) {
    const session = await db.formSession.findUnique({
      where: { id: body.sessionId },
      select: {
        id: true,
        revision: true,
        status: true,
        createdById: true,
        payloadJson: true,
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Proposta não encontrada para finalização." }, { status: 404 });
    }
    if (!canManageProposal(auth.user.role, session.createdById, auth.user.id)) {
      return NextResponse.json({ error: "Sem permissao para finalizar esta proposta." }, { status: 403 });
    }
    const ownerSchemaBlocks = await resolveSchemaBlocks(auth.user.activeCompanyId);
    if (ownerSchemaBlocks.length === 0) {
      return NextResponse.json(
        { error: "Empresa da proposta sem blocos ativos de formulario." },
        { status: 400 },
      );
    }
    schemaBlocks = ownerSchemaBlocks;
    const isTerminalSession =
      session.status === "FINALIZED" || session.status === "ARCHIVED";
    skipFinalizeAndRuleBlock = isTerminalSession;
    if (!isTerminalSession) {
      if (typeof body.expectedRevision === "number" && body.expectedRevision !== session.revision) {
        return NextResponse.json(
          {
            error: "Conflito de versao ao finalizar. Recarregue a proposta e tente novamente.",
            currentRevision: session.revision,
          },
          { status: 409 },
        );
      }
    }
    let payloadObj: Record<string, string>;
    try {
      payloadObj = JSON.parse((session as { payloadJson?: string }).payloadJson ?? "{}") as Record<string, string>;
    } catch {
      return NextResponse.json(
        { error: "Payload da proposta no servidor esta corrompido (JSON invalido). Contacte o suporte." },
        { status: 500 },
      );
    }
    const preSales = parsePreSalesMeta(payloadObj);
    if (!isTerminalSession && preSales.stage !== "APPROVED_PRE_SALES" && auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "A proposta precisa de parecer técnico aprovado pelo pré-vendas antes da finalização." }, { status: 400 });
    }
    if (!isTerminalSession) {
      const gate = canTransition(session.status as ProposalStatus, "FINALIZED", auth.user.role);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.reason }, { status: 400 });
      }
      if (body.expectedRevision === undefined) {
        return NextResponse.json(
          {
            error: "expectedRevision obrigatório para finalizar proposta versionada.",
            currentRevision: session.revision,
          },
          { status: 400 },
        );
      }
      proposalSession = session;
    }
  }

  rules = avaliarRegras(formData);
  requiredBySchema = schemaBlocks
    .filter((b) => rules.visibleBlocks.has(b.id))
    .flatMap((b) => b.fields)
    .filter((f) => f.required)
    .map((f) => f.id);
  schemaFieldIds = new Set(schemaBlocks.flatMap((b) => b.fields.map((f) => f.id)));
  requiredByRules = Array.from(rules.requiredFields).filter((fieldId) =>
    schemaFieldIds.has(fieldId),
  );
  allRequired = new Set([...requiredBySchema, ...requiredByRules]);
  missing = Array.from(allRequired).filter(
    (fieldId) => !String(formData[fieldId] ?? "").trim(),
  );
  allErrors = [...rules.errors, ...missing.map((f) => `Campo obrigatório não preenchido: ${f}`)];

  if (!skipFinalizeAndRuleBlock && allErrors.length > 0) {
    await db.auditLog.create({
      data: {
        action: "DOCUMENT_GENERATION_BLOCKED",
        resourceType: "Submission",
        resourceId: body.sessionId ?? "N/A",
        detailsJson: JSON.stringify({ errors: allErrors }),
        userId: auth.user.id,
        formSessionId: body.sessionId ?? null,
      },
    });
    return NextResponse.json(
      { error: "Envio bloqueado por regras obrigatorias.", details: allErrors },
      { status: 400 },
    );
  }

  const lines = flatLines(formData, rules.warnings, rules.errors, schemaBlocks);
  const outputFile = outputFormat === "pdf" ? "documento-tecnico.pdf" : "documento-tecnico.docx";

  const submission = await db.submission.create({
    data: {
      internalName: formData.nome_interno_solicitacao || formData.cenario_atual_conectividade || "sem_nome_interno",
      payloadJson: JSON.stringify(formData),
      warningsJson: JSON.stringify(rules.warnings),
      generatedDoc: outputFile,
      createdById: auth.user.id,
    },
  });

  await db.auditLog.create({
    data: {
      action: "DOCUMENT_GENERATED",
      resourceType: "Submission",
      resourceId: submission.id,
      detailsJson: JSON.stringify({
        format: outputFormat,
        warningsCount: rules.warnings.length,
        proposalId: body.sessionId ?? null,
      }),
      userId: auth.user.id,
      submissionId: submission.id,
      formSessionId: body.sessionId ?? null,
    },
  });
  logger.info({ submissionId: submission.id, user: auth.user.email, format: outputFormat }, "Documento técnico gerado");

  if (proposalSession) {
    const payloadJson = JSON.stringify(formData);
    const warningsJson = JSON.stringify(rules.warnings);
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.formSession.update({
        where: { id: proposalSession.id },
        data: {
          status: "FINALIZED",
          payloadJson,
          warningsJson,
          finalDocument: outputFile,
          finalizedAt: new Date(),
          revision: proposalSession.revision + 1,
        },
      });
      await tx.proposalRevision.create({
        data: {
          formSessionId: updated.id,
          status: updated.status,
          payloadJson: updated.payloadJson,
          warningsJson: updated.warningsJson,
          note: "Finalização com documento técnico",
          createdById: auth.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "PROPOSAL_FINALIZED",
          resourceType: "FormSession",
          resourceId: updated.id,
          formSessionId: updated.id,
          detailsJson: JSON.stringify({
            submissionId: submission.id,
            format: outputFormat,
            revision: updated.revision,
          }),
          userId: auth.user.id,
          submissionId: submission.id,
        },
      });
    });
  }

  if (outputFormat === "pdf") {
    const pdf = await generateTechnicalPdf(lines);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="documento-tecnico.pdf"',
      },
    });
  }

  const docx = await generateDocx(lines);
  return new NextResponse(new Uint8Array(docx), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": 'attachment; filename="documento-tecnico.docx"',
    },
  });
  } catch (e: unknown) {
    logger.error({ err: e }, "Falha em POST /api/document");
    const message = e instanceof Error ? e.message : "Erro interno ao gerar documento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
