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

  it("retorna 404 ao editar pergunta de outra empresa", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q_v8",
      blockId: "b_v8",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b_v8", companyId: "c_v8", ownerId: "a1" },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q_v8", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Nome" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q_v8" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurso não encontrado");
    expect(dbMock.formQuestion.update).not.toHaveBeenCalled();
  });

  it("retorna 404 ao editar pergunta de bloco de outro usuario", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q_gean",
      blockId: "b_gean",
      fieldId: "campo",
      label: "Campo",
      type: "text",
      optionsJson: null,
      block: { id: "b_gean", companyId: "c_v8", ownerId: "gean" },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-questions/q_gean", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Hack" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "q_gean" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurso não encontrado");
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
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b1", companyId: "c_attend", ownerId: "a1" },
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
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b1", companyId: "c_attend", ownerId: "a1" },
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

  it("permite desativar pergunta com active=false (FORM_QUESTION_DISABLED)", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "su1",
        email: "super@formsis.local",
        role: "SUPER_ADMIN",
        name: "Super",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q1",
      blockId: "b1",
      fieldId: "nome_cliente",
      label: "Nome do cliente",
      type: "text",
      optionsJson: null,
      block: { id: "b1", companyId: "c_attend", ownerId: "su1" },
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

    const auditArgs = dbMock.auditLog.create.mock.calls[0][0] as {
      data: { action: string };
    };
    expect(auditArgs.data.action).toBe("FORM_QUESTION_DISABLED");
  });

  it("SUPER_ADMIN edita apenas pergunta do proprio bloco na empresa ativa", async () => {
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
    dbMock.formQuestion.findUnique.mockResolvedValue({
      id: "q_v8",
      blockId: "b_v8",
      fieldId: "nome_cliente",
      label: "Nome",
      type: "text",
      optionsJson: null,
      block: { id: "b_v8", companyId: "c_v8", ownerId: "su1" },
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
