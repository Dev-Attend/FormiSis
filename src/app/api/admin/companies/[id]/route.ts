import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { patchCompanyBodySchema } from "@/lib/validators/adminCompanies";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = patchCompanyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: { name?: string; slug?: string; active?: boolean } = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.slug !== undefined) update.slug = parsed.data.slug;
  if (parsed.data.active !== undefined) update.active = parsed.data.active;

  try {
    const company = await db.company.update({
      where: { id },
      data: update,
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        action: "COMPANY_UPDATED",
        resourceType: "Company",
        resourceId: company.id,
        detailsJson: JSON.stringify({
          fields: Object.keys(update),
          name: company.name,
          slug: company.slug,
          active: company.active,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ company });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ja existe empresa com este slug." }, { status: 409 });
      }
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 });
      }
    }
    throw e;
  }
}
