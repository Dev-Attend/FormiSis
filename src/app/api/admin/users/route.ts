import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { createUserBodySchema } from "@/lib/validators/adminUsers";

function parseCompanyFilter(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("companyId");
  if (!value) return null;
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
      return NextResponse.json({ error: "Sem permissao para listar usuarios de outra empresa." }, { status: 403 });
    }
  }

  const where = isSuperAdmin
    ? companyFilter
      ? { companyId: companyFilter }
      : undefined
    : { companyId: auth.user.companyId! };

  const users = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({ users });
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

  const parsed = createUserBodySchema.safeParse(body);
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
      { error: "Nao e permitido criar usuario em outra empresa." },
      { status: 403 },
    );
  }

  const targetCompanyId = isSuperAdmin ? parsed.data.companyId ?? null : auth.user.companyId;

  if (!targetCompanyId) {
    const message = isSuperAdmin
      ? "companyId e obrigatorio para SUPER_ADMIN criar usuario."
      : "Empresa obrigatoria para criar usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
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

  const { name, email, password, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        active: true,
        companyId: targetCompanyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true, slug: true } },
      },
    });

    await db.auditLog.create({
      data: {
        action: "USER_CREATED",
        resourceType: "User",
        resourceId: user.id,
        detailsJson: JSON.stringify({
          role: user.role,
          active: user.active,
          companyId: user.companyId,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Ja existe usuario com este e-mail." }, { status: 409 });
    }
    throw e;
  }
}
