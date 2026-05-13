import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createFormBlockBodySchema } from "@/lib/validators/adminFormBuilder";

function parseCompanyFilter(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) return null;
  const normalized = companyId.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const isSuperAdmin = auth.user.role === "SUPER_ADMIN";
  const companyFilter = parseCompanyFilter(request);

  if (!isSuperAdmin) {
    if (!auth.user.companyId) {
      return NextResponse.json({ error: "Administrador sem empresa vinculada." }, { status: 403 });
    }
    if (companyFilter && companyFilter !== auth.user.companyId) {
      return NextResponse.json(
        { error: "Sem permissao para listar blocos de outra empresa." },
        { status: 403 },
      );
    }
  }

  const where = isSuperAdmin
    ? companyFilter
      ? { companyId: companyFilter }
      : undefined
    : { companyId: auth.user.companyId! };

  const blocks = await db.formBlock.findMany({
    where,
    orderBy: [{ companyId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      companyId: true,
      blockKey: true,
      title: true,
      description: true,
      order: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, name: true, slug: true } },
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json({ blocks });
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

  const parsed = createFormBlockBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const isSuperAdmin = auth.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && !auth.user.companyId) {
    return NextResponse.json({ error: "Administrador sem empresa vinculada." }, { status: 403 });
  }

  if (!isSuperAdmin && parsed.data.companyId && parsed.data.companyId !== auth.user.companyId) {
    return NextResponse.json(
      { error: "Nao e permitido criar blocos para outra empresa." },
      { status: 403 },
    );
  }

  const targetCompanyId = isSuperAdmin ? parsed.data.companyId ?? null : auth.user.companyId;
  if (!targetCompanyId) {
    return NextResponse.json(
      { error: "companyId e obrigatorio para SUPER_ADMIN criar bloco." },
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

  try {
    const block = await db.formBlock.create({
      data: {
        companyId: targetCompanyId,
        blockKey: parsed.data.blockKey,
        title: parsed.data.title,
        description: normalizeNullableText(parsed.data.description) ?? null,
        order: parsed.data.order,
        active: parsed.data.active ?? true,
      },
      select: {
        id: true,
        companyId: true,
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
        action: "FORM_BLOCK_CREATED",
        resourceType: "FormBlock",
        resourceId: block.id,
        detailsJson: JSON.stringify({
          blockKey: block.blockKey,
          title: block.title,
          order: block.order,
          active: block.active,
          companyId: block.companyId,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Ja existe bloco com esta chave para a empresa informada." },
        { status: 409 },
      );
    }

    logger.error({ err: error }, "Falha ao criar bloco de formulario.");
    return NextResponse.json(
      { error: "Erro interno ao criar bloco de formulario." },
      { status: 500 },
    );
  }
}
