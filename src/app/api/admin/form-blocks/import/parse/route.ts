import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  extractTextFromPdfBuffer,
  parseBlocksFromText,
} from "@/lib/pdfImport/blockParser";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const isSuperAdmin = auth.user.role === "SUPER_ADMIN";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio invalido. Use multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo PDF obrigatorio no campo 'file'." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "Arquivo excede 10MB." }, { status: 413 });
  }
  const fileType = file.type?.toLowerCase() ?? "";
  const fileName = (file.name ?? "").toLowerCase();
  if (!fileName.endsWith(".pdf") && fileType !== "application/pdf") {
    return NextResponse.json({ error: "Apenas arquivos PDF sao aceitos." }, { status: 415 });
  }

  const companyIdParam = (formData.get("companyId") as string | null)?.trim() || null;

  if (!isSuperAdmin && !auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
      { status: 409 },
    );
  }

  if (!isSuperAdmin && companyIdParam && companyIdParam !== auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Sem permissao para importar para outra empresa." },
      { status: 403 },
    );
  }

  const targetCompanyId = isSuperAdmin ? companyIdParam : auth.user.activeCompanyId;
  if (!targetCompanyId) {
    return NextResponse.json(
      { error: "companyId e obrigatorio para SUPER_ADMIN importar PDF." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: targetCompanyId },
    select: { id: true, name: true, slug: true, active: true },
  });
  if (!company || !company.active) {
    return NextResponse.json(
      { error: "Empresa informada inexistente ou inativa." },
      { status: 400 },
    );
  }

  let extractedText: string;
  let parsedBlocks;
  try {
    const buffer = await file.arrayBuffer();
    extractedText = await extractTextFromPdfBuffer(buffer);
    parsedBlocks = parseBlocksFromText(extractedText);
  } catch (error) {
    logger.error({ err: error }, "Falha ao extrair texto do PDF.");
    return NextResponse.json(
      { error: "Nao foi possivel ler o PDF. Verifique se nao esta protegido por senha." },
      { status: 422 },
    );
  }

  if (parsedBlocks.length === 0) {
    logger.warn(
      { textLength: extractedText.length, preview: extractedText.slice(0, 800) },
      "PDF extraido mas nenhum bloco detectado.",
    );
    return NextResponse.json(
      {
        error: "Nenhum bloco/pergunta detectado no PDF (use o padrao 'N. Titulo').",
        debug: {
          textLength: extractedText.length,
          preview: extractedText.slice(0, 800),
        },
      },
      { status: 422 },
    );
  }

  type ExistingBlock = {
    id: string;
    blockKey: string;
    title: string;
    order: number;
    questions: Array<{ fieldId: string }>;
  };

  // Colisao considera apenas blocos do proprio usuario na empresa.
  const existingBlocks: ExistingBlock[] = await db.formBlock.findMany({
    where: { companyId: targetCompanyId, ownerId: auth.user.id },
    select: {
      id: true,
      blockKey: true,
      title: true,
      order: true,
      questions: { select: { fieldId: true } },
    },
  });
  const existingBlockMap = new Map<string, { id: string; title: string; fieldIds: Set<string> }>();
  let maxExistingOrder = 0;
  for (const block of existingBlocks) {
    existingBlockMap.set(block.blockKey, {
      id: block.id,
      title: block.title,
      fieldIds: new Set<string>(block.questions.map((q) => q.fieldId)),
    });
    if (block.order > maxExistingOrder) maxExistingOrder = block.order;
  }

  const baseOrder = maxExistingOrder;

  const previewBlocks = parsedBlocks.map((block, index) => {
    const collision = existingBlockMap.get(block.blockKey);
    const questions = block.questions.map((question) => ({
      fieldId: question.fieldId,
      label: question.label,
      type: question.type,
      options: question.options ?? null,
      order: question.order,
      requiredDefault: false,
      collidesWith: collision?.fieldIds.has(question.fieldId) ?? false,
    }));
    return {
      blockKey: block.blockKey,
      title: block.title,
      description: null,
      order: baseOrder + index + 1,
      questions,
      collision: collision
        ? {
            existingBlockId: collision.id,
            existingTitle: collision.title,
            existingQuestionCount: collision.fieldIds.size,
          }
        : null,
    };
  });

  return NextResponse.json({
    company: { id: company.id, name: company.name, slug: company.slug },
    blocks: previewBlocks,
  });
}
