import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const dbMock = db as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  company: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

describe("Admin users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN lista usuarios de todas as empresas", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "su1",
        email: "super@formsis.local",
        role: "SUPER_ADMIN",
        name: "Super",
        companyId: null,
        company: null,
      },
    });
    dbMock.user.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/users"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toEqual([]);
    const query = dbMock.user.findMany.mock.calls[0][0] as { where?: unknown };
    expect(query.where).toBeUndefined();
  });

  it("ADMIN nao lista usuarios de outra empresa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "a1",
        email: "admin@attend.local",
        role: "ADMIN",
        name: "Admin",
        companyId: "c_attend",
        company: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3001/api/admin/users?companyId=c_v8"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.user.findMany).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN cria ADMIN vinculado a empresa V8", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "su1",
        email: "super@formsis.local",
        role: "SUPER_ADMIN",
        name: "Super",
        companyId: null,
        company: null,
      },
    });
    dbMock.company.findUnique.mockResolvedValue({ id: "c_v8", active: true });
    dbMock.user.create.mockResolvedValue({
      id: "u_v8_admin",
      name: "Admin V8",
      email: "admin.v8@formsis.local",
      role: "ADMIN",
      active: true,
      companyId: "c_v8",
      createdAt: new Date(),
      updatedAt: new Date(),
      company: { id: "c_v8", name: "V8", slug: "v8" },
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Admin V8",
        email: "admin.v8@formsis.local",
        password: "SenhaForte123",
        role: "ADMIN",
        companyId: "c_v8",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.companyId).toBe("c_v8");
  });

  it("ADMIN cria usuario apenas na propria empresa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "a1",
        email: "admin@attend.local",
        role: "ADMIN",
        name: "Admin",
        companyId: "c_attend",
        company: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    dbMock.company.findUnique.mockResolvedValue({ id: "c_attend", active: true });
    dbMock.user.create.mockResolvedValue({
      id: "u_attend_1",
      name: "Comercial Attend",
      email: "comercial@attend.local",
      role: "COMERCIAL",
      active: true,
      companyId: "c_attend",
      createdAt: new Date(),
      updatedAt: new Date(),
      company: { id: "c_attend", name: "Attend", slug: "attend" },
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_2" });

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Comercial Attend",
        email: "comercial@attend.local",
        password: "SenhaForte123",
        role: "COMERCIAL",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const createArgs = dbMock.user.create.mock.calls[0][0] as {
      data: { companyId: string };
    };
    expect(createArgs.data.companyId).toBe("c_attend");
  });

  it("ADMIN nao consegue criar usuario em outra empresa via companyId manual", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "a1",
        email: "admin@attend.local",
        role: "ADMIN",
        name: "Admin",
        companyId: "c_attend",
        company: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Usuario V8",
        email: "usuario.v8@formsis.local",
        password: "SenhaForte123",
        role: "COMERCIAL",
        companyId: "c_v8",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.user.create).not.toHaveBeenCalled();
  });

  it("usuario comum nao acessa rota admin", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Perfil sem permissao." }, { status: 403 }),
    });

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/users"));
    expect(response.status).toBe(403);
  });
});
