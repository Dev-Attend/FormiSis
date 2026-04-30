import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import { blocos } from "@/lib/formSchema";
import { avaliarRegras } from "@/lib/rulesEngine";
import { requireApiAccess } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { canManageProposal } from "@/lib/proposalPersistence";
import { canTransition, type ProposalStatus } from "@/lib/proposalWorkflow";
import { parsePreSalesMeta } from "@/lib/preSalesMeta";

function flatLines(data: Record<string, string>, warnings: string[], errors: string[]) {
  const lines: string[] = [];
  lines.push("DOCUMENTO TECNICO AUTOMATICO - FORMSIS");
  lines.push("");
  lines.push("VALIDACOES E REGRAS");
  warnings.forEach((w) => lines.push(`ALERTA: ${w}`));
  errors.forEach((e) => lines.push(`ERRO: ${e}`));
  lines.push("");
  lines.push("RESPOSTAS DO FORMULARIO (POR BLOCO)");
  blocos.forEach((bloco) => {
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

async function generatePdf(lines: string[]) {
  return new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    const pdf = new PDFDocument({ margin: 40, size: "A4" });
    pdf.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    lines.forEach((line) => pdf.text(line));
    pdf.end();
  });
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

  const body = (await request.json()) as {
    data: Record<string, string>;
    sessionId?: string;
    expectedRevision?: number;
  };

  const outputFormat = body.data._output_format === "pdf" ? "pdf" : "docx";
  const rules = avaliarRegras(body.data);
  const requiredBySchema = blocos
    .filter((b) => rules.visibleBlocks.has(b.id))
    .flatMap((b) => b.fields)
    .filter((f) => f.required)
    .map((f) => f.id);
  const allRequired = new Set([...requiredBySchema, ...Array.from(rules.requiredFields)]);
  const missing = Array.from(allRequired).filter(
    (fieldId) => !String(body.data[fieldId] ?? "").trim(),
  );
  const allErrors = [...rules.errors, ...missing.map((f) => `Campo obrigatório não preenchido: ${f}`)];

  if (allErrors.length > 0) {
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

  let proposalSession: {
    id: string;
    revision: number;
    status: string;
    createdById: string;
  } | null = null;

  if (body.sessionId) {
    const session = await db.formSession.findUnique({
      where: { id: body.sessionId },
      select: { id: true, revision: true, status: true, createdById: true, payloadJson: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Proposta não encontrada para finalização." }, { status: 404 });
    }
    if (!canManageProposal(auth.user.role, session.createdById, auth.user.id)) {
      return NextResponse.json({ error: "Sem permissao para finalizar esta proposta." }, { status: 403 });
    }
    if (session.status === "FINALIZED") {
      return NextResponse.json({ error: "Proposta ja finalizada." }, { status: 400 });
    }
    if (typeof body.expectedRevision === "number" && body.expectedRevision !== session.revision) {
      return NextResponse.json(
        {
          error: "Conflito de versao ao finalizar. Recarregue a proposta e tente novamente.",
          currentRevision: session.revision,
        },
        { status: 409 },
      );
    }
    const payloadObj = JSON.parse((session as { payloadJson?: string }).payloadJson ?? "{}") as Record<string, string>;
    const preSales = parsePreSalesMeta(payloadObj);
    if (preSales.stage !== "APPROVED_PRE_SALES" && auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "A proposta precisa de parecer técnico aprovado pelo pré-vendas antes da finalização." }, { status: 400 });
    }
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

  const lines = flatLines(body.data, rules.warnings, rules.errors);
  const outputFile = outputFormat === "pdf" ? "documento-tecnico.pdf" : "documento-tecnico.docx";

  const submission = await db.submission.create({
    data: {
      internalName: body.data.nome_interno_solicitacao || "sem_nome_interno",
      payloadJson: JSON.stringify(body.data),
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
    const payloadJson = JSON.stringify(body.data);
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
    const pdf = await generatePdf(lines);
    return new NextResponse(new Uint8Array(pdf), {
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
}

