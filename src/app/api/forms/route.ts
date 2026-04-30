import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allocateUniqueProposalId } from "@/lib/proposalId";
import { requireApiAccess } from "@/lib/auth";
import { applyPreSalesMeta, defaultPreSalesMeta } from "@/lib/preSalesMeta";

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, [
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  const scopeMine = request.nextUrl.searchParams.get("scope") === "mine";
  const restrictToOwner =
    auth.user.role === "COMERCIAL" ||
    (scopeMine && (auth.user.role === "ADMIN" || auth.user.role === "PRE_VENDAS"));

  const sessions = await db.formSession.findMany({
    where: restrictToOwner ? { createdById: auth.user.id } : {},
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAccess(request, ["ADMIN", "COMERCIAL", "PRE_VENDAS"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    title?: string;
    clientName?: string;
    opportunityRef?: string;
    payload?: Record<string, string>;
    warnings?: string[];
  };

  const title = body.title?.trim() || "Proposta sem titulo";
  const payloadWithMeta = applyPreSalesMeta(body.payload ?? {}, {
    ...defaultPreSalesMeta,
    checklist: { ...defaultPreSalesMeta.checklist },
  });
  const payloadJson = JSON.stringify(payloadWithMeta);
  const warningsJson = JSON.stringify(body.warnings ?? []);
  const id = await allocateUniqueProposalId();

  const status = "IN_PROGRESS" as const;
  const created = await db.formSession.create({
    data: {
      id,
      title,
      status,
      clientName: body.clientName?.trim() || null,
      opportunityRef: body.opportunityRef?.trim() || null,
      payloadJson,
      warningsJson,
      createdById: auth.user.id,
      revision: 1,
      proposalRevisions: {
        create: {
          status,
          payloadJson,
          warningsJson,
          note: "Criacao da proposta",
          createdById: auth.user.id,
        },
      },
      audits: {
        create: {
          action: "PROPOSAL_CREATED",
          resourceType: "FormSession",
          resourceId: id,
          detailsJson: JSON.stringify({ title, status, preSalesStage: "DRAFTING" }),
          userId: auth.user.id,
        },
      },
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      revision: created.revision,
      status: created.status,
    },
    { status: 201 },
  );
}
