import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, ["ADMIN", "PRE_VENDAS"]);
  if (!auth.ok) return auth.response;

  const rows = await db.submission.findMany({
    orderBy: { generatedAt: "desc" },
    take: 50,
    include: { createdBy: true },
  });
  const typedRows = rows as Array<{
    id: string;
    internalName: string;
    generatedDoc: string;
    generatedAt: Date;
    createdBy: { email: string };
  }>;

  return NextResponse.json({
    submissions: typedRows.map((r) => ({
      id: r.id,
      internalName: r.internalName,
      generatedDoc: r.generatedDoc,
      generatedAt: r.generatedAt,
      createdBy: r.createdBy.email,
    })),
  });
}
