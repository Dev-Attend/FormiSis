import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export type UserRole = "ADMIN" | "COMERCIAL" | "PRE_VENDAS" | "LEITURA";

export type AuthResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        role: UserRole;
        name: string;
        companyId: string | null;
        company: { id: string; name: string; slug: string } | null;
      };
    }
  | { ok: false; response: NextResponse };

const SESSION_COOKIE = "formsis_session";
const encoder = new TextEncoder();

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET nao configurado no ambiente.");
  return encoder.encode(secret);
}

type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSessionSecret());
}

async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (!payload.sub || !payload.email || !payload.role || !payload.name) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      role: String(payload.role) as UserRole,
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}

function isSecureCookieEnv() {
  const secureFlag = process.env.AUTH_SECURE_COOKIES;
  if (secureFlag === "1") return true;
  if (secureFlag === "0") return false;
  return process.env.NODE_ENV === "production";
}

function cookieHeader(name: string, value: string, maxAgeSec: number) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (isSecureCookieEnv()) parts.push("Secure");
  return parts.join("; ");
}

export function buildSessionCookie(token: string) {
  return cookieHeader(SESSION_COOKIE, token, 8 * 60 * 60);
}

export function clearSessionCookie() {
  return cookieHeader(SESSION_COOKIE, "", 0);
}

export async function requireApiAccess(
  request: NextRequest,
  allowedRoles: UserRole[],
): Promise<AuthResult> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  const session = await verifySession(token);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sessao invalida ou expirada." }, { status: 401 }),
    };
  }

  const user = await db.user.findUnique({
    where: { email: session.email },
    include: { company: { select: { id: true, name: true, slug: true, active: true } } },
  });

  if (!user || !user.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Usuário não encontrado ou inativo." }, { status: 403 }),
    };
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Perfil sem permissão para esta operação." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
      companyId: user.companyId,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
          }
        : null,
    },
  };
}

/** Sessao a partir do cookie (Server Components / rotas server). */
export async function getServerSessionUser(): Promise<{
  id: string;
  email: string;
  role: UserRole;
  name: string;
  companyId: string | null;
} | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({ where: { email: session.email } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role as UserRole,
    name: user.name,
    companyId: user.companyId,
  };
}
