import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  buildSessionCookie: vi.fn((token: string) => `formsis_session=${token}; Path=/`),
  signSession: vi.fn(async () => "signed-jwt-token"),
  getSelectableCompaniesForUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: vi.fn(() => ({ allowed: true })),
  getRequestClientKey: vi.fn(() => "127.0.0.1"),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async () => true),
  },
}));

import { POST } from "./route";
import { db } from "@/lib/db";
import { getSelectableCompaniesForUser, signSession } from "@/lib/auth";

const dbMock = db as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};
const getSelectableMock = vi.mocked(getSelectableCompaniesForUser);
const signSessionMock = vi.mocked(signSession);

function loginRequest(email = "user@formsis.local", password = "Senha123") {
  return new NextRequest("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usuario com 1 empresa entra direto com activeCompanyId no JWT", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "Comercial",
      email: "user@formsis.local",
      role: "COMERCIAL",
      active: true,
      passwordHash: "x",
    });
    getSelectableMock.mockResolvedValue([
      { id: "c_attend", name: "Attend", slug: "attend" },
    ]);

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresCompanySelection).toBe(false);
    expect(body.user.activeCompanyId).toBe("c_attend");
    expect(signSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeCompanyId: "c_attend" }),
    );
  });

  it("usuario com 2+ empresas recebe requiresCompanySelection sem activeCompanyId", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "u2",
      name: "Multi",
      email: "multi@formsis.local",
      role: "COMERCIAL",
      active: true,
      passwordHash: "x",
    });
    getSelectableMock.mockResolvedValue([
      { id: "c_attend", name: "Attend", slug: "attend" },
      { id: "c_v8", name: "V8", slug: "v8" },
    ]);

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requiresCompanySelection).toBe(true);
    expect(body.user.activeCompanyId).toBe(null);
    expect(signSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeCompanyId: null }),
    );
  });

  it("usuario operacional sem nenhuma empresa vinculada e bloqueado", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "u3",
      name: "Orfao",
      email: "orfao@formsis.local",
      role: "COMERCIAL",
      active: true,
      passwordHash: "x",
    });
    getSelectableMock.mockResolvedValue([]);

    const response = await POST(loginRequest("orfao@formsis.local"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("sem empresa");
    expect(signSessionMock).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN sem empresas pode logar sem activeCompanyId", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "su1",
      name: "Super",
      email: "super@formsis.local",
      role: "SUPER_ADMIN",
      active: true,
      passwordHash: "x",
    });
    getSelectableMock.mockResolvedValue([]);

    const response = await POST(loginRequest("super@formsis.local"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.activeCompanyId).toBe(null);
    expect(signSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeCompanyId: null }),
    );
  });
});
