import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess, type UserRole } from "@/lib/auth";
import { assertNotLastActiveAdmin, assertOperationalUserHasCompany } from "@/lib/adminPolicy";
import { patchUserBodySchema } from "@/lib/validators/adminUsers";

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const existingUser = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      companies: { select: { companyId: true } },
    },
  });
  if (!existingUser) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const isSuperAdmin = auth.user.role === "SUPER_ADMIN";
  const existingCompanyIds = existingUser.companies.map(
    (link: { companyId: string }) => link.companyId,
  );

  if (!isSuperAdmin) {
    if (!auth.user.activeCompanyId) {
      return NextResponse.json(
        { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
        { status: 409 },
      );
    }
    if (!existingCompanyIds.includes(auth.user.activeCompanyId)) {
      return NextResponse.json(
        { error: "Sem permissao para editar usuario de outra empresa." },
        { status: 403 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = patchUserBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const guard = await assertNotLastActiveAdmin(id, {
    role: data.role as UserRole | undefined,
    active: data.active,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: 400 });
  }

  if (!isSuperAdmin && data.companyIds !== undefined) {
    const proposed = new Set(data.companyIds);
    const current = new Set(existingCompanyIds);
    const diffAdd = data.companyIds.filter((c: string) => !current.has(c));
    const diffRemove = existingCompanyIds.filter((c: string) => !proposed.has(c));
    const restricted = [...diffAdd, ...diffRemove].some(
      (c: string) => c !== auth.user.activeCompanyId,
    );
    if (restricted) {
      return NextResponse.json(
        { error: "Administrador nao pode alterar vinculos fora da propria empresa." },
        { status: 403 },
      );
    }
  }

  const update: {
    name?: string;
    email?: string;
    role?: UserRole;
    active?: boolean;
    passwordHash?: string;
  } = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email;
  if (data.role !== undefined) update.role = data.role;
  if (data.active !== undefined) update.active = data.active;
  if (data.password !== undefined) {
    update.passwordHash = await bcrypt.hash(data.password, 12);
  }

  const resultingRole = (data.role ?? existingUser.role) as UserRole;
  const resultingCompanyIds = data.companyIds ?? existingCompanyIds;

  const opGuard = assertOperationalUserHasCompany(resultingRole, resultingCompanyIds);
  if (!opGuard.ok) {
    return NextResponse.json({ error: opGuard.message }, { status: 400 });
  }

  if (data.companyIds !== undefined && data.companyIds.length > 0) {
    const companies = await db.company.findMany({
      where: { id: { in: data.companyIds } },
      select: { id: true, active: true },
    });
    if (companies.length !== data.companyIds.length) {
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

  if (Object.keys(update).length === 0 && data.companyIds === undefined) {
    return NextResponse.json({ error: "Nada a atualizar." }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      if (Object.keys(update).length > 0) {
        await tx.user.update({ where: { id }, data: update });
      }
      if (data.companyIds !== undefined) {
        const proposed = new Set(data.companyIds);
        const current = new Set(existingCompanyIds);
        const toAdd = data.companyIds.filter((c: string) => !current.has(c));
        const toRemove = existingCompanyIds.filter((c: string) => !proposed.has(c));
        if (toRemove.length > 0) {
          await tx.userCompany.deleteMany({
            where: { userId: id, companyId: { in: toRemove } },
          });
        }
        if (toAdd.length > 0) {
          await tx.userCompany.createMany({
            data: toAdd.map((companyId: string) => ({ userId: id, companyId })),
          });
        }
      }
      return tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
    });

    await db.auditLog.create({
      data: {
        action: "USER_UPDATED",
        resourceType: "User",
        resourceId: updated.id,
        detailsJson: JSON.stringify({
          fields: Object.keys(update),
          companyIdsChanged: data.companyIds !== undefined,
          role: updated.role,
          active: updated.active,
          companyIds: resultingCompanyIds,
          previousCompanyIds: existingCompanyIds,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });
    return NextResponse.json({ user: shapeUser(updated) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ja existe usuario com este e-mail." }, { status: 409 });
      }
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
      }
    }
    throw e;
  }
}
