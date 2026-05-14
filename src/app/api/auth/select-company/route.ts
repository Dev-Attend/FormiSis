import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildSessionCookie,
  requireApiAccess,
  signSession,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await requireApiAccess(request, [
    "SUPER_ADMIN",
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const companyId = String((body as { companyId?: string })?.companyId ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId obrigatorio." }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true, active: true },
  });
  if (!company || !company.active) {
    return NextResponse.json(
      { error: "Empresa inexistente ou inativa." },
      { status: 403 },
    );
  }

  if (auth.user.role !== "SUPER_ADMIN") {
    const link = await db.userCompany.findUnique({
      where: { userId_companyId: { userId: auth.user.id, companyId: company.id } },
    });
    if (!link) {
      return NextResponse.json(
        { error: "Usuario nao tem vinculo com a empresa selecionada." },
        { status: 403 },
      );
    }
  }

  const token = await signSession({
    sub: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
    name: auth.user.name,
    activeCompanyId: company.id,
  });

  await db.auditLog.create({
    data: {
      action: "COMPANY_SELECTED",
      resourceType: "Company",
      resourceId: company.id,
      detailsJson: JSON.stringify({
        previousCompanyId: auth.user.activeCompanyId,
        actorRole: auth.user.role,
      }),
      userId: auth.user.id,
    },
  });

  return new NextResponse(
    JSON.stringify({
      ok: true,
      activeCompany: { id: company.id, name: company.name, slug: company.slug },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildSessionCookie(token),
      },
    },
  );
}
