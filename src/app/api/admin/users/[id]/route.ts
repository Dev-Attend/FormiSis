import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess, type UserRole } from "@/lib/auth";
import { assertNotLastActiveAdmin } from "@/lib/adminPolicy";
import { patchUserBodySchema } from "@/lib/validators/adminUsers";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

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
  const nextRole = data.role;
  const nextActive = data.active;
  const guard = await assertNotLastActiveAdmin(id, {
    role: nextRole as UserRole | undefined,
    active: nextActive,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: 400 });
  }

  const update: {
    name?: string;
    email?: string;
    role?: UserRole;
    companyId?: string;
    active?: boolean;
    passwordHash?: string;
  } = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email;
  if (data.role !== undefined) update.role = data.role;
  if (data.companyId !== undefined) {
    const company = await db.company.findUnique({
      where: { id: data.companyId },
      select: { id: true, active: true },
    });
    if (!company || !company.active) {
      return NextResponse.json(
        { error: "Empresa informada inexistente ou inativa." },
        { status: 400 },
      );
    }
    update.companyId = data.companyId;
  }
  if (data.active !== undefined) update.active = data.active;
  if (data.password !== undefined) {
    update.passwordHash = await bcrypt.hash(data.password, 12);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada a atualizar." }, { status: 400 });
  }

  try {
    const user = await db.user.update({
      where: { id },
      data: update,
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
        action: "USER_UPDATED",
        resourceType: "User",
        resourceId: user.id,
        detailsJson: JSON.stringify({
          fields: Object.keys(update),
          role: user.role,
          active: user.active,
          companyId: user.companyId,
        }),
        userId: auth.user.id,
      },
    });
    return NextResponse.json({ user });
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
