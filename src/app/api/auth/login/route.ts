import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { buildSessionCookie, signSession } from "@/lib/auth";
import { enforceRateLimit, getRequestClientKey } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const ip = getRequestClientKey(request);
  const rl = enforceRateLimit(`login:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec ?? 60) } },
    );
  }

  const body = (await request.json()) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 });
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return new NextResponse(
    JSON.stringify({ ok: true, user: { name: user.name, email: user.email, role: user.role } }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildSessionCookie(token),
      },
    },
  );
}
