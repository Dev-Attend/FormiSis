import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN", "COMERCIAL", "PRE_VENDAS", "LEITURA"]);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ user: auth.user });
}
