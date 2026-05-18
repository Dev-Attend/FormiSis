import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    formBlock: {
      findUnique: vi.fn(),
    },
    formQuestion: {
      findMany: vi.fn(),
      create: vi.fn(),
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
    findUnique: ReturnType<typeof vi.fn>;
  };
  formQuestion: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

describe("Admin form block questions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 404 ao listar perguntas de bloco de outro usuario", async () => {
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
      id: "b_gean",
      companyId: "c_v8",
      ownerId: "gean",
      blockKey: "bloco1",
      title: "Bloco do Gean",
      description: null,
      order: 1,
      active: true,
      company: { id: "c_v8", name: "V8", slug: "v8" },
    });

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/form-blocks/b_gean/questions"), {
      params: Promise.resolve({ id: "b_gean" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurso não encontrado");
    expect(dbMock.formQuestion.findMany).not.toHaveBeenCalled();
  });

  it("lista perguntas do bloco ordenadas", async () => {
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
    dbMock.formBlock.findUnique.mockResolvedValue({
      id: "b_attend",
      companyId: "c_attend",
      ownerId: "su1",
      blockKey: "bloco1",
      title: "Bloco Attend",
      description: null,
      order: 1,
      active: true,
      company: { id: "c_attend", name: "Attend", slug: "attend" },
    });
    dbMock.formQuestion.findMany.mockResolvedValue([
      {
        id: "q1",
        blockId: "b_attend",
        fieldId: "tipo_de_link",
        label: "Tipo de link",
        type: "select",
        placeholder: null,
        helpText: null,
        requiredDefault: true,
        optionsJson: JSON.stringify([
          { label: "Fibra", value: "fibra" },
          { label: "Radio", value: "radio" },
        ]),
        validationJson: JSON.stringify({}),
        order: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const response = await GET(
      new NextRequest("http://localhost:3001/api/admin/form-blocks/b_attend/questions"),
      { params: Promise.resolve({ id: "b_attend" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.questions[0].options[0].value).toBe("fibra");
  });

  it("ADMIN lista perguntas do proprio bloco", async () => {
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
      id: "b_attend",
      companyId: "c_attend",
      ownerId: "a1",
      blockKey: "bloco1",
      title: "Bloco Attend",
      description: null,
      order: 1,
      active: true,
      company: { id: "c_attend", name: "Attend", slug: "attend" },
    });
    dbMock.formQuestion.findMany.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost:3001/api/admin/form-blocks/b_attend/questions"),
      { params: Promise.resolve({ id: "b_attend" }) },
    );

    expect(response.status).toBe(200);
    expect(dbMock.formQuestion.findMany).toHaveBeenCalledTimes(1);
  });

  it("cria pergunta com fieldId derivado de toFieldId(label)", async () => {
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
      id: "b_attend",
      companyId: "c_attend",
      ownerId: "a1",
      blockKey: "bloco1",
      title: "Bloco Attend",
      company: { id: "c_attend", name: "Attend", slug: "attend" },
    });
    dbMock.formQuestion.create.mockResolvedValue({
      id: "q_new",
      blockId: "b_attend",
      fieldId: "tipo_de_link",
      label: "Tipo de Link",
      type: "select",
      placeholder: null,
      helpText: null,
      requiredDefault: true,
      optionsJson: JSON.stringify([
        { label: "Fibra", value: "fibra" },
        { label: "Radio", value: "radio" },
      ]),
      validationJson: JSON.stringify({}),
      order: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_q_1" });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_attend/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Tipo de Link",
        type: "select",
        options: [
          { label: "Fibra", value: "fibra" },
          { label: "Radio", value: "radio" },
        ],
        order: 1,
        requiredDefault: true,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "b_attend" }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.question.fieldId).toBe("tipo_de_link");
  });

  it("rejeita pergunta select sem opcoes", async () => {
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
      id: "b_attend",
      companyId: "c_attend",
      ownerId: "a1",
      blockKey: "bloco1",
      title: "Bloco Attend",
      company: { id: "c_attend", name: "Attend", slug: "attend" },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_attend/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Tipo de Link",
        type: "select",
        order: 1,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "b_attend" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("exigem opcoes");
    expect(dbMock.formQuestion.create).not.toHaveBeenCalled();
  });

  it("retorna 404 ao criar pergunta em bloco de outro usuario", async () => {
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
      id: "b_gean",
      companyId: "c_v8",
      ownerId: "gean",
      blockKey: "bloco1",
      title: "Bloco do Gean",
      company: { id: "c_v8", name: "V8", slug: "v8" },
    });

    const request = new NextRequest("http://localhost:3001/api/admin/form-blocks/b_gean/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Campo", type: "text", order: 1 }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "b_gean" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Recurso não encontrado");
    expect(dbMock.formQuestion.create).not.toHaveBeenCalled();
  });

  it("usuario sem permissao nao acessa rota", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Perfil sem permissao." }, { status: 403 }),
    });

    const response = await GET(new NextRequest("http://localhost:3001/api/admin/form-blocks/b1/questions"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(response.status).toBe(403);
  });
});
