import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { createCompanyBodySchema } from "@/lib/validators/adminCompanies";

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;

  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({ companies });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = createCompanyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const company = await db.company.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        active: true,
      },
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
        action: "COMPANY_CREATED",
        resourceType: "Company",
        resourceId: company.id,
        detailsJson: JSON.stringify({
          name: company.name,
          slug: company.slug,
          active: company.active,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Ja existe empresa com este slug." }, { status: 409 });
    }
    throw e;
  }
}
