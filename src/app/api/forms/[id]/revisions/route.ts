import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { canViewProposal } from "@/lib/proposalPersistence";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, [
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const session = await db.formSession.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Proposta nao encontrada." }, { status: 404 });
  }

  if (!canViewProposal(auth.user.role, session.createdById, auth.user.id)) {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  const revisions = await db.proposalRevision.findMany({
    where: { formSessionId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });

  const audits = await db.auditLog.findMany({
    where: { formSessionId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ revisions, audits });
}
