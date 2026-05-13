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

  it("ADMIN nao edita bloco de outra empresa", async () => {
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
    dbMock.formBlock.findUnique.mockResolvedValue({ id: "b_v8_1", companyId: "c_v8" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_v8_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Novo titulo" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "b_v8_1" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.formBlock.update).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN desativa bloco com active=false", async () => {
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
    dbMock.formBlock.findUnique.mockResolvedValue({ id: "b_v8_1", companyId: "c_v8" });
    dbMock.formBlock.update.mockResolvedValue({
      id: "b_v8_1",
      companyId: "c_v8",
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
