import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    formBlock: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

import { PATCH } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const dbMock = db as {
  formBlock: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

describe("Admin form blocks [id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 404 ao editar bloco de outro usuario na mesma empresa", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "fulano",
        email: "fulano@v8.local",
        role: "ADMIN",
        name: "Fulano",
        activeCompanyId: "c_v8",
        activeCompany: { id: "c_v8", name: "V8", slug: "v8" },
      },
    });
    dbMock.formBlock.findUnique.mockResolvedValue({
      id: "b_gean_1",
      companyId: "c_v8",
      ownerId: "gean",
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_gean_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Novo titulo" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "b_gean_1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurso não encontrado");
    expect(dbMock.formBlock.update).not.toHaveBeenCalled();
  });

  it("ADMIN nao edita bloco de outra empresa (404)", async () => {
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
    dbMock.formBlock.findUnique.mockResolvedValue({
      id: "b_v8_1",
      companyId: "c_v8",
      ownerId: "a1",
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_v8_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Novo titulo" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "b_v8_1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurso não encontrado");
    expect(dbMock.formBlock.update).not.toHaveBeenCalled();
  });

  it("dono desativa bloco com active=false e gera FORM_BLOCK_DISABLED", async () => {
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
    dbMock.formBlock.findUnique.mockResolvedValue({
      id: "b_v8_1",
      companyId: "c_v8",
      ownerId: "su1",
    });
    dbMock.formBlock.update.mockResolvedValue({
      id: "b_v8_1",
      companyId: "c_v8",
      ownerId: "su1",
      blockKey: "bloco22",
      title: "Bloco 22",
      description: null,
      order: 22,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      company: { id: "c_v8", name: "V8", slug: "v8" },
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_block_1" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_v8_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "b_v8_1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.block.active).toBe(false);

    const updateArgs = dbMock.formBlock.update.mock.calls[0][0] as {
      data: { active: boolean };
    };
    expect(updateArgs.data.active).toBe(false);

    const auditArgs = dbMock.auditLog.create.mock.calls[0][0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("FORM_BLOCK_DISABLED");
  });

  it("rejeita requisicao nao autenticada", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Novo titulo" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "b1" }) });
    expect(response.status).toBe(401);
  });
});
