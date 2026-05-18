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

  // Isolamento por dono: qualquer papel gerencia apenas os proprios blocos
  // (ownerId = usuario autenticado). Escopo de empresa:
  // - SUPER_ADMIN: empresa escolhida no seletor (?companyId);
  // - ADMIN: empresa ativa da sessao.
  let companyScope: string;
  if (isSuperAdmin) {
    if (!companyFilter) {
      return NextResponse.json({ blocks: [] });
    }
    companyScope = companyFilter;
  } else {
    if (!auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
        { status: 409 },
      );
    }
    if (companyFilter && companyFilter !== auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Sem permissao para listar blocos de outra empresa." },
        { status: 403 },
      );
    }
    companyScope = auth.user.activeCompanyId;
  }

  const where = {
    companyId: companyScope,
    ownerId: auth.user.id,
  };

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
  let targetCompanyId: string;
  if (isSuperAdmin) {
    if (!parsed.data.companyId) {
      return NextResponse.json(
        { error: "companyId e obrigatorio para SUPER_ADMIN criar bloco." },
        { status: 400 },
      );
    }
    targetCompanyId = parsed.data.companyId;
  } else {
    if (!auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
        { status: 409 },
      );
    }
    if (parsed.data.companyId && parsed.data.companyId !== auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Nao e permitido criar blocos para outra empresa." },
        { status: 403 },
      );
    }
    targetCompanyId = auth.user.activeCompanyId;
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
        ownerId: auth.user.id,
        blockKey: parsed.data.blockKey,
        title: parsed.data.title,
        description: normalizeNullableText(parsed.data.description) ?? null,
        order: parsed.data.order,
        active: parsed.data.active ?? true,
      },
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
        action: "FORM_BLOCK_CREATED",
        resourceType: "FormBlock",
        resourceId: block.id,
        detailsJson: JSON.stringify({
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

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Voce ja possui um bloco com esta chave nesta empresa." },
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
