import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "COMERCIAL" | "PRE_VENDAS" | "LEITURA";

export function isAdminRole(role: UserRole) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  activeCompanyId: string | null;
  activeCompany: { id: string; name: string; slug: string } | null;
};

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

const SESSION_COOKIE = "formsis_session";
const encoder = new TextEncoder();

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET nao configurado no ambiente.");
  return encoder.encode(secret);
}

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  activeCompanyId?: string | null;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    name: payload.name,
    activeCompanyId: payload.activeCompanyId ?? null,
  })
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
    const rawActive = (payload as Record<string, unknown>).activeCompanyId;
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      role: String(payload.role) as UserRole,
      name: String(payload.name),
      activeCompanyId:
        typeof rawActive === "string" && rawActive.length > 0 ? rawActive : null,
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

export async function getUserCompanyIds(userId: string): Promise<string[]> {
  const links = await db.userCompany.findMany({
    where: { userId },
    select: { companyId: true },
  });
  return links.map((link: { companyId: string }) => link.companyId);
}

export async function getSelectableCompaniesForUser(
  userId: string,
  role: UserRole,
): Promise<{ id: string; name: string; slug: string }[]> {
  if (role === "SUPER_ADMIN") {
    return db.company.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }
  const links = await db.userCompany.findMany({
    where: { userId, company: { active: true } },
    select: { company: { select: { id: true, name: true, slug: true } } },
    orderBy: { company: { name: "asc" } },
  });
  return links.map(
    (link: { company: { id: string; name: string; slug: string } }) => link.company,
  );
}

export async function requireApiAccess(
  request: NextRequest,
  allowedRoles: UserRole[],
): Promise<AuthResult> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
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
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  if (!user || !user.active) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Usuario nao encontrado ou inativo." }, { status: 403 }),
    };
  }

  const userRole = user.role as UserRole;
  const hasDirectRoleAccess = allowedRoles.includes(userRole);
  const hasAdminInheritance = userRole === "SUPER_ADMIN" && allowedRoles.includes("ADMIN");
  if (!hasDirectRoleAccess && !hasAdminInheritance) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Perfil sem permissao para esta operacao." }, { status: 403 }),
    };
  }

  let activeCompany: { id: string; name: string; slug: string } | null = null;
  if (session.activeCompanyId) {
    const company = await db.company.findUnique({
      where: { id: session.activeCompanyId },
      select: { id: true, name: true, slug: true, active: true },
    });
    if (!company || !company.active) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Empresa ativa indisponivel. Selecione outra empresa." },
          { status: 403 },
        ),
      };
    }
    if (userRole !== "SUPER_ADMIN") {
      const link = await db.userCompany.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: company.id } },
      });
      if (!link) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Sem vinculo com a empresa ativa selecionada." },
            { status: 403 },
          ),
        };
      }
    }
    activeCompany = { id: company.id, name: company.name, slug: company.slug };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: userRole,
      name: user.name,
      activeCompanyId: activeCompany?.id ?? null,
      activeCompany,
    },
  };
}

export type ServerSessionUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  activeCompanyId: string | null;
};

export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
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
    activeCompanyId: session.activeCompanyId ?? null,
  };
}
