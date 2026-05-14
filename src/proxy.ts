import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "formsis_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/submissoes") ||
    pathname.startsWith("/propostas") ||
    pathname.startsWith("/pre-vendas") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/select-company");
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/submissoes",
    "/submissoes/:path*",
    "/propostas",
    "/propostas/:path*",
    "/pre-vendas",
    "/pre-vendas/:path*",
    "/admin",
    "/admin/:path*",
    "/select-company",
  ],
};
