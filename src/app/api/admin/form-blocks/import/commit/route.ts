import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  commitImportBodySchema,
  type CollisionStrategy,
  type CommitImportBlock,
  type CommitImportQuestion,
} from "@/lib/validators/pdfImport";

function renameBlockKey(blockKey: string, used: Set<string>): string {
  let suffix = 2;
  let candidate = `${blockKey}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${blockKey}_${suffix}`;
  }
  return candidate;
}

async function applyBlock(
  companyId: string,
  ownerId: string,
  block: CommitImportBlock,
  existingBlockKeys: Set<string>,
): Promise<{ status: "created" | "replaced" | "skipped" | "renamed"; blockKey: string; blockId?: string }> {
  const strategy: CollisionStrategy = block.strategy;
  const exists = existingBlockKeys.has(block.blockKey);

  if (exists && strategy === "skip") {
    return { status: "skipped", blockKey: block.blockKey };
  }

  if (exists && strategy === "replace") {
    const target = await db.formBlock.findFirst({
      where: { companyId, ownerId, blockKey: block.blockKey },
      select: { id: true },
    });
    if (target) {
      await db.formQuestion.deleteMany({ where: { blockId: target.id } });
      await db.formBlock.update({
        where: { id: target.id },
        data: {
          title: block.title,
          description: block.description ?? null,
          order: block.order,
          active: true,
        },
      });
      await createQuestions(target.id, block.questions);
      return { status: "replaced", blockKey: block.blockKey, blockId: target.id };
    }
  }

  let effectiveKey = block.blockKey;
  if (exists && strategy === "rename") {
    effectiveKey = renameBlockKey(block.blockKey, existingBlockKeys);
  }

  const created = await db.formBlock.create({
    data: {
      companyId,
      ownerId,
      blockKey: effectiveKey,
      title: block.title,
      description: block.description ?? null,
      order: block.order,
      active: true,
    },
    select: { id: true, blockKey: true },
  });
  await createQuestions(created.id, block.questions);
  existingBlockKeys.add(effectiveKey);

  return {
    status: exists && strategy === "rename" ? "renamed" : "created",
    blockKey: created.blockKey,
    blockId: created.id,
  };
}

async function createQuestions(blockId: string, questions: CommitImportQuestion[]) {
  for (const question of questions) {
    await db.formQuestion.create({
      data: {
        blockId,
        fieldId: question.fieldId,
        label: question.label,
        type: question.type,
        placeholder: null,
        helpText: null,
        requiredDefault: Boolean(question.requiredDefault),
        optionsJson: question.options?.length ? JSON.stringify(question.options) : null,
        validationJson: null,
        order: question.order,
        active: true,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = commitImportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const isSuperAdmin = auth.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && !auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
      { status: 409 },
    );
  }

  if (!isSuperAdmin && parsed.data.companyId && parsed.data.companyId !== auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Sem permissao para importar para outra empresa." },
      { status: 403 },
    );
  }

  const targetCompanyId = isSuperAdmin ? parsed.data.companyId ?? null : auth.user.activeCompanyId;
  if (!targetCompanyId) {
    return NextResponse.json(
      { error: "companyId e obrigatorio para SUPER_ADMIN importar PDF." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: targetCompanyId },
    select: { id: true, active: true },
  });
  if (!company || !company.active) {
    return NextResponse.json(
      { error: "Empresa informada inexistente ou inativa." },
      { status: 400 },
    );
  }

  // Colisao opera apenas sobre os blocos do proprio usuario na empresa.
  const existingBlocks = await db.formBlock.findMany({
    where: { companyId: targetCompanyId, ownerId: auth.user.id },
    select: { blockKey: true },
  });
  const existingBlockKeys = new Set<string>(
    existingBlocks.map((b: { blockKey: string }) => b.blockKey),
  );

  const results: Array<{
    blockKey: string;
    status: "created" | "replaced" | "skipped" | "renamed";
    blockId?: string;
  }> = [];

  try {
    for (const block of parsed.data.blocks) {
      const result = await applyBlock(targetCompanyId, auth.user.id, block, existingBlockKeys);
      results.push(result);
    }
  } catch (error) {
    logger.error({ err: error }, "Falha ao aplicar import de PDF.");
    return NextResponse.json(
      { error: "Erro interno ao importar blocos do PDF." },
      { status: 500 },
    );
  }

  await db.auditLog.create({
    data: {
      action: "FORM_BLOCKS_IMPORTED_FROM_PDF",
      resourceType: "FormBlock",
      resourceId: targetCompanyId,
      detailsJson: JSON.stringify({
        companyId: targetCompanyId,
        ownerId: auth.user.id,
        actorRole: auth.user.role,
        results,
        totalBlocks: parsed.data.blocks.length,
        totalQuestions: parsed.data.blocks.reduce((sum, b) => sum + b.questions.length, 0),
      }),
      userId: auth.user.id,
    },
  });

  return NextResponse.json({ results });
}
