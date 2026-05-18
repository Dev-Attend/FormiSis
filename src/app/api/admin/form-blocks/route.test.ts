import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    formBlock: {
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, POST } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const dbMock = db as {
  formBlock: {
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

describe("Admin form blocks route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN sem empresa ativa recebe 409", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "su1",
        email: "super@formsis.local",
        role: "SUPER_ADMIN",
        name: "Super",
        activeCompanyId: null,
        activeCompany: null,
      },
    });

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/form-blocks"));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.redirectTo).toBe("/select-company");
    expect(dbMock.formBlock.findMany).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN tambem lista apenas os proprios blocos na empresa ativa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "su1",
        email: "super@formsis.local",
        role: "SUPER_ADMIN",
        name: "Super",
        activeCompanyId: "c_v8",
        activeCompany: { id: "c_v8", name: "V8", slug: "v8" },
      },
    });
    dbMock.formBlock.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/form-blocks"));
    expect(response.status).toBe(200);

    const query = dbMock.formBlock.findMany.mock.calls[0][0] as {
      where?: { companyId?: string; ownerId?: string };
    };
    expect(query.where?.companyId).toBe("c_v8");
    expect(query.where?.ownerId).toBe("su1");
  });

  it("ADMIN nao lista blocos de outra empresa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "a1",
        email: "admin@attend.local",
        role: "ADMIN",
        name: "Admin",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3001/api/admin/form-blocks?companyId=c_v8"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.formBlock.findMany).not.toHaveBeenCalled();
  });

  it("ADMIN lista somente blocos da propria empresa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "a1",
        email: "admin@attend.local",
        role: "ADMIN",
        name: "Admin",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    dbMock.formBlock.findMany.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/form-blocks"));
    expect(response.status).toBe(200);

    const query = dbMock.formBlock.findMany.mock.calls[0][0] as {
      where?: { companyId?: string; ownerId?: string };
    };
    expect(query.where?.companyId).toBe("c_attend");
    expect(query.where?.ownerId).toBe("a1");
  });

  it("SUPER_ADMIN cria bloco como dono na empresa ativa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "su1",
        email: "super@formsis.local",
        role: "SUPER_ADMIN",
        name: "Super",
        activeCompanyId: "c_v8",
        activeCompany: { id: "c_v8", name: "V8", slug: "v8" },
      },
    });
    dbMock.company.findUnique.mockResolvedValue({ id: "c_v8", active: true });
    dbMock.formBlock.create.mockResolvedValue({
      id: "b_v8_1",
      companyId: "c_v8",
      ownerId: "su1",
      blockKey: "bloco22",
      title: "Bloco novo",
      description: null,
      order: 22,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      company: { id: "c_v8", name: "V8", slug: "v8" },
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        blockKey: "bloco22",
        title: "Bloco novo",
        order: 22,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.block.companyId).toBe("c_v8");
    expect(body.block.ownerId).toBe("su1");

    const createArgs = dbMock.formBlock.create.mock.calls[0][0] as {
      data: { companyId: string; ownerId: string };
    };
    expect(createArgs.data.companyId).toBe("c_v8");
    expect(createArgs.data.ownerId).toBe("su1");
  });

  it("ADMIN nao cria bloco em outra empresa via companyId", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "a1",
        email: "admin@attend.local",
        role: "ADMIN",
        name: "Admin",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: "c_v8",
        blockKey: "bloco22",
        title: "Bloco novo",
        order: 22,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.formBlock.create).not.toHaveBeenCalled();
  });

  it("usuario sem permissao nao acessa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Perfil sem permissao." }, { status: 403 }),
    });

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/form-blocks"));
    expect(response.status).toBe(403);
  });
});
