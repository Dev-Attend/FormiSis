import { NextRequest, NextResponse } from "next/server";
import {
  getSelectableCompaniesForUser,
  requireApiAccess,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, [
    "SUPER_ADMIN",
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  const companies = await getSelectableCompaniesForUser(auth.user.id, auth.user.role);
  return NextResponse.json({ companies });
}
