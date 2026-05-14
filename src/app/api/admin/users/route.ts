import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { assertOperationalUserHasCompany } from "@/lib/adminPolicy";
import { createUserBodySchema } from "@/lib/validators/adminUsers";

function parseCompanyFilter(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("companyId");
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  companies: {
    select: { company: { select: { id: true, name: true, slug: true, active: true } } },
  },
} as const;

function shapeUser(row: {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  companies: { company: { id: string; name: string; slug: string; active: boolean } }[];
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    companies: row.companies.map((link) => link.company),
    companyIds: row.companies.map((link) => link.company.id),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const isSuperAdmin = auth.user.role === "SUPER_ADMIN";
  const companyFilter = parseCompanyFilter(request);

  if (!isSuperAdmin) {
    if (!auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
        { status: 409 },
      );
    }
    if (companyFilter && companyFilter !== auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Sem permissao para listar usuarios de outra empresa." },
        { status: 403 },
      );
    }
  }

  const scopedCompanyId = isSuperAdmin ? companyFilter : auth.user.activeCompanyId!;
  const where: Prisma.UserWhereInput = scopedCompanyId
    ? { companies: { some: { companyId: scopedCompanyId } } }
    : {};

  const users = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: userSelect,
  });

  return NextResponse.json({ users: users.map(shapeUser) });
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

  if (!isSuperAdmin && !auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
      { status: 409 },
    );
  }

  let targetCompanyIds: string[];
  if (isSuperAdmin) {
    targetCompanyIds = parsed.data.companyIds ?? [];
  } else {
    if (
      parsed.data.companyIds &&
      parsed.data.companyIds.some((id) => id !== auth.user.activeCompanyId)
    ) {
      return NextResponse.json(
        { error: "Administrador so pode vincular usuario a propria empresa." },
        { status: 403 },
      );
    }
    targetCompanyIds = [auth.user.activeCompanyId!];
  }

  const opGuard = assertOperationalUserHasCompany(parsed.data.role, targetCompanyIds);
  if (!opGuard.ok) {
    return NextResponse.json({ error: opGuard.message }, { status: 400 });
  }

  if (targetCompanyIds.length > 0) {
    const companies = await db.company.findMany({
      where: { id: { in: targetCompanyIds } },
      select: { id: true, active: true },
    });
    if (companies.length !== targetCompanyIds.length) {
      return NextResponse.json(
        { error: "Uma ou mais empresas informadas nao foram encontradas." },
        { status: 400 },
      );
    }
    const inactive = companies.find((c: { id: string; active: boolean }) => !c.active);
    if (inactive) {
      return NextResponse.json(
        { error: "Uma das empresas informadas esta inativa." },
        { status: 400 },
      );
    }
  }

  const { name, email, password, role } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const created = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role, active: true },
      });
      if (targetCompanyIds.length > 0) {
        await tx.userCompany.createMany({
          data: targetCompanyIds.map((companyId: string) => ({ userId: user.id, companyId })),
        });
      }
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: userSelect });
    });

    await db.auditLog.create({
      data: {
        action: "USER_CREATED",
        resourceType: "User",
        resourceId: created.id,
        detailsJson: JSON.stringify({
          role: created.role,
          active: created.active,
          companyIds: targetCompanyIds,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ user: shapeUser(created) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Ja existe usuario com este e-mail." }, { status: 409 });
    }
    throw e;
  }
}
