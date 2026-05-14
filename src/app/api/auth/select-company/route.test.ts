import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
  buildSessionCookie: vi.fn((token: string) => `formsis_session=${token}; Path=/`),
  signSession: vi.fn(async () => "new-jwt"),
}));

vi.mock("@/lib/db", () => ({
  db: {
    company: { findUnique: vi.fn() },
    userCompany: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { POST } from "./route";
import { requireApiAccess, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const signSessionMock = vi.mocked(signSession);
const dbMock = db as unknown as {
  company: { findUnique: ReturnType<typeof vi.fn> };
  userCompany: { findUnique: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const adminAuth = {
  ok: true as const,
  user: {
    id: "a1",
    email: "admin@attend.local",
    role: "ADMIN" as const,
    name: "Admin",
    activeCompanyId: null,
    activeCompany: null,
  },
};

const superAdminAuth = {
  ok: true as const,
  user: {
    id: "su1",
    email: "super@formsis.local",
    role: "SUPER_ADMIN" as const,
    name: "Super",
    activeCompanyId: null,
    activeCompany: null,
  },
};

function postRequest(companyId: string) {
  return new NextRequest("http://localhost:3001/api/auth/select-company", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId }),
  });
}

describe("POST /api/auth/select-company", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ADMIN seleciona empresa vinculada e ativa", async () => {
    requireApiAccessMock.mockResolvedValue(adminAuth);
    dbMock.company.findUnique.mockResolvedValue({
      id: "c_attend",
      name: "Attend",
      slug: "attend",
      active: true,
    });
    dbMock.userCompany.findUnique.mockResolvedValue({
      userId: "a1",
      companyId: "c_attend",
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const response = await POST(postRequest("c_attend"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activeCompany.id).toBe("c_attend");
    expect(signSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeCompanyId: "c_attend" }),
    );
    expect(dbMock.auditLog.create).toHaveBeenCalled();
  });

  it("rejeita empresa inativa", async () => {
    requireApiAccessMock.mockResolvedValue(adminAuth);
    dbMock.company.findUnique.mockResolvedValue({
      id: "c_v8",
      name: "V8",
      slug: "v8",
      active: false,
    });

    const response = await POST(postRequest("c_v8"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("inativa");
    expect(signSessionMock).not.toHaveBeenCalled();
  });

  it("ADMIN nao seleciona empresa sem vinculo", async () => {
    requireApiAccessMock.mockResolvedValue(adminAuth);
    dbMock.company.findUnique.mockResolvedValue({
      id: "c_v8",
      name: "V8",
      slug: "v8",
      active: true,
    });
    dbMock.userCompany.findUnique.mockResolvedValue(null);

    const response = await POST(postRequest("c_v8"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("vinculo");
    expect(signSessionMock).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN seleciona qualquer empresa ativa sem vinculo", async () => {
    requireApiAccessMock.mockResolvedValue(superAdminAuth);
    dbMock.company.findUnique.mockResolvedValue({
      id: "c_v8",
      name: "V8",
      slug: "v8",
      active: true,
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_2" });

    const response = await POST(postRequest("c_v8"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activeCompany.id).toBe("c_v8");
    expect(dbMock.userCompany.findUnique).not.toHaveBeenCalled();
    expect(signSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeCompanyId: "c_v8" }),
    );
  });

  it("rejeita request sem autenticacao", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    });

    const response = await POST(postRequest("c_attend"));
    expect(response.status).toBe(401);
  });

  it("rejeita payload sem companyId", async () => {
    requireApiAccessMock.mockResolvedValue(adminAuth);

    const request = new NextRequest("http://localhost:3001/api/auth/select-company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
