import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { patchFormBlockBodySchema } from "@/lib/validators/adminFormBuilder";

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (!auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
      { status: 409 },
    );
  }

  const existingBlock = await db.formBlock.findUnique({
    where: { id },
    select: { id: true, companyId: true, ownerId: true },
  });
  // Isolamento por empresa + dono. Retorna 404 (e nao 403) para nao
  // revelar a existencia de recurso de outro usuario/empresa.
  if (
    !existingBlock ||
    existingBlock.companyId !== auth.user.activeCompanyId ||
    existingBlock.ownerId !== auth.user.id
  ) {
    return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = patchFormBlockBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: {
    blockKey?: string;
    title?: string;
    description?: string | null;
    order?: number;
    active?: boolean;
  } = {};

  if (parsed.data.blockKey !== undefined) update.blockKey = parsed.data.blockKey;
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    update.description = normalizeNullableText(parsed.data.description) ?? null;
  }
  if (parsed.data.order !== undefined) update.order = parsed.data.order;
  if (parsed.data.active !== undefined) update.active = parsed.data.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada a atualizar." }, { status: 400 });
  }

  try {
    const block = await db.formBlock.update({
      where: { id: existingBlock.id },
      data: update,
      select: {
        id: true,
        companyId: true,
        ownerId: true,
        blockKey: true,
        title: true,
        description: true,
        order: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true, slug: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action:
          update.active === false ? "FORM_BLOCK_DISABLED" : "FORM_BLOCK_UPDATED",
        resourceType: "FormBlock",
        resourceId: block.id,
        detailsJson: JSON.stringify({
          fields: Object.keys(update),
          blockKey: block.blockKey,
          title: block.title,
          order: block.order,
          active: block.active,
          companyId: block.companyId,
          ownerId: block.ownerId,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ block });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Voce ja possui um bloco com esta chave nesta empresa." },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Bloco nao encontrado." }, { status: 404 });
      }
    }

    logger.error({ err: error }, "Falha ao atualizar bloco de formulario.");
    return NextResponse.json(
      { error: "Erro interno ao atualizar bloco de formulario." },
      { status: 500 },
    );
  }
}
