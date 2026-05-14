import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    userCompany: {
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { GET, POST } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const dbMock = db as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
  };
  company: {
    findMany: ReturnType<typeof vi.fn>;
  };
  userCompany: {
    createMany: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
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

const adminAttendAuth = {
  ok: true as const,
  user: {
    id: "a1",
    email: "admin@attend.local",
    role: "ADMIN" as const,
    name: "Admin",
    activeCompanyId: "c_attend",
    activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
  },
};

function userRowFixture(overrides: {
  id: string;
  name: string;
  email: string;
  role: string;
  companies: { id: string; name: string; slug: string }[];
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email,
    role: overrides.role,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    companies: overrides.companies.map((c) => ({
      company: { ...c, active: true },
    })),
  };
}

describe("Admin users route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") {
        return (fn as (tx: unknown) => Promise<unknown>)({
          user: {
            create: vi.fn().mockResolvedValue({ id: "tx_user" }),
          },
          userCompany: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          findUniqueOrThrow: vi.fn(),
        });
      }
      return null;
    });
  });

  it("SUPER_ADMIN lista usuarios de todas as empresas", async () => {
    requireApiAccessMock.mockResolvedValue(superAdminAuth);
    dbMock.user.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/users"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toEqual([]);
    const query = dbMock.user.findMany.mock.calls[0][0] as { where?: unknown };
    expect(query.where).toEqual({});
  });

  it("ADMIN nao lista usuarios de outra empresa", async () => {
    requireApiAccessMock.mockResolvedValue(adminAttendAuth);

    const response = await GET(
      new NextRequest("http://localhost:3001/api/admin/users?companyId=c_v8"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.user.findMany).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN cria ADMIN vinculado a empresa V8", async () => {
    requireApiAccessMock.mockResolvedValue(superAdminAuth);
    dbMock.company.findMany.mockResolvedValue([{ id: "c_v8", active: true }]);
    dbMock.$transaction.mockResolvedValue(
      userRowFixture({
        id: "u_v8_admin",
        name: "Admin V8",
        email: "admin.v8@formsis.local",
        role: "ADMIN",
        companies: [{ id: "c_v8", name: "V8", slug: "v8" }],
      }),
    );
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Admin V8",
        email: "admin.v8@formsis.local",
        password: "SenhaForte123",
        role: "ADMIN",
        companyIds: ["c_v8"],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.companyIds).toEqual(["c_v8"]);
  });

  it("SUPER_ADMIN pode vincular usuario a multiplas empresas", async () => {
    requireApiAccessMock.mockResolvedValue(superAdminAuth);
    dbMock.company.findMany.mockResolvedValue([
      { id: "c_v8", active: true },
      { id: "c_attend", active: true },
    ]);
    dbMock.$transaction.mockResolvedValue(
      userRowFixture({
        id: "u_multi",
        name: "Multi",
        email: "multi@formsis.local",
        role: "COMERCIAL",
        companies: [
          { id: "c_v8", name: "V8", slug: "v8" },
          { id: "c_attend", name: "Attend", slug: "attend" },
        ],
      }),
    );
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_multi" });

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Multi",
        email: "multi@formsis.local",
        password: "SenhaForte123",
        role: "COMERCIAL",
        companyIds: ["c_v8", "c_attend"],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.companyIds.sort()).toEqual(["c_attend", "c_v8"]);
  });

  it("ADMIN cria usuario apenas na propria empresa (companyIds ignorado)", async () => {
    requireApiAccessMock.mockResolvedValue(adminAttendAuth);
    dbMock.company.findMany.mockResolvedValue([{ id: "c_attend", active: true }]);
    dbMock.$transaction.mockResolvedValue(
      userRowFixture({
        id: "u_attend_1",
        name: "Comercial Attend",
        email: "comercial@attend.local",
        role: "COMERCIAL",
        companies: [{ id: "c_attend", name: "Attend", slug: "attend" }],
      }),
    );
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
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.user.companyIds).toEqual(["c_attend"]);
  });

  it("ADMIN nao consegue criar usuario em outra empresa via companyIds manual", async () => {
    requireApiAccessMock.mockResolvedValue(adminAttendAuth);

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Usuario V8",
        email: "usuario.v8@formsis.local",
        password: "SenhaForte123",
        role: "COMERCIAL",
        companyIds: ["c_v8"],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("propria empresa");
  });

  it("rejeita criar usuario operacional sem empresas (SUPER_ADMIN)", async () => {
    requireApiAccessMock.mockResolvedValue(superAdminAuth);

    const request = new NextRequest("http://localhost:3001/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sem empresa",
        email: "sem@formsis.local",
        password: "SenhaForte123",
        role: "COMERCIAL",
        companyIds: [],
      }),
    });

    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("empresa");
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
