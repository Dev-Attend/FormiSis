import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    formQuestion: {
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
  formQuestion: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

describe("Admin form questions [id] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ADMIN nao edita pergunta de outra empresa", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q_v8",
      blockId: "b_v8",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b_v8", companyId: "c_v8" },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q_v8", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Nome" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q_v8" }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("outra empresa");
    expect(dbMock.formQuestion.update).not.toHaveBeenCalled();
  });

  it("edita label sem alterar fieldId automaticamente", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b1", companyId: "c_attend" },
    });
    dbMock.formQuestion.update.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome completo do cliente",
      type: "text",
      placeholder: null,
      helpText: null,
      requiredDefault: false,
      optionsJson: null,
      validationJson: null,
      order: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_q_2" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Nome completo do cliente" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.question.fieldId).toBe("nome_cliente");

    const updateArgs = dbMock.formQuestion.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.fieldId).toBeUndefined();
  });

  it("rejeita troca para select sem opcoes", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b1", companyId: "c_attend" },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "select" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("exigem opcoes");
    expect(dbMock.formQuestion.update).not.toHaveBeenCalled();
  });

  it("permite desativar pergunta com active=false", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b1", companyId: "c_attend" },
    });
    dbMock.formQuestion.update.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      placeholder: null,
      helpText: null,
      requiredDefault: false,
      optionsJson: null,
      validationJson: null,
      order: 1,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_q_3" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.question.active).toBe(false);
  });

  it("SUPER_ADMIN edita pergunta de qualquer empresa", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q_v8",
      blockId: "b_v8",
      fieldId: "nome_cliente",
      label: "Nome",
      type: "text",
      optionsJson: null,
      block: { id: "b_v8", companyId: "c_v8" },
    });
    dbMock.formQuestion.update.mockResolvedValue({
      id: "q_v8",
      blockId: "b_v8",
      fieldId: "nome_cliente",
      label: "Nome completo",
      type: "text",
      placeholder: null,
      helpText: null,
      requiredDefault: false,
      optionsJson: null,
      validationJson: null,
      order: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_q_4" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q_v8", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Nome completo" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q_v8" }) });
    expect(response.status).toBe(200);
  });

  it("rejeita requisicao nao autenticada", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Teste" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q1" }) });
    expect(response.status).toBe(401);
  });
});
