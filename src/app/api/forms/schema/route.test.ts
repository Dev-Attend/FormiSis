import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/formSchemaService", () => ({
  loadTenantFormSchemaByCompanyId: vi.fn(),
}));

import { GET } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { loadTenantFormSchemaByCompanyId } from "@/lib/formSchemaService";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const loadTenantFormSchemaByCompanyIdMock = vi.mocked(loadTenantFormSchemaByCompanyId);

function buildRequest() {
  return new NextRequest("http://localhost:3001/api/forms/schema");
}

const attendSchema = {
  company: { id: "c_attend", name: "Attend", slug: "attend" },
  blocks: [
    {
      id: "b21",
      key: "bloco21",
      title: "Interno",
      description: null,
      order: 21,
      questions: [
        {
          id: "q21-2",
          fieldId: "aprovacao_tecnica",
          label: "Aprovacao tecnica",
          type: "select" as const,
          order: 2,
          required: true,
          options: [],
          validation: {},
        },
      ],
    },
    {
      id: "b1",
      key: "bloco1",
      title: "Contexto Attend",
      description: "Bloco da Attend",
      order: 1,
      questions: [
        {
          id: "q1-2",
          fieldId: "escopo_unidades",
          label: "Escopo",
          type: "number" as const,
          order: 2,
          required: true,
          options: [],
          validation: {},
        },
        {
          id: "q1-1",
          fieldId: "cenario_atual_conectividade",
          label: "Cenario",
          type: "textarea" as const,
          order: 1,
          required: true,
          options: [],
          validation: {},
        },
      ],
    },
  ],
};

const v8Schema = {
  company: { id: "c_v8", name: "V8", slug: "v8" },
  blocks: [
    {
      id: "b1-v8",
      key: "bloco1",
      title: "Contexto V8",
      description: "Bloco da V8",
      order: 1,
      questions: [
        {
          id: "qv8-1",
          fieldId: "objetivo_de_conectividade_v8",
          label: "Objetivo",
          type: "textarea" as const,
          order: 1,
          required: true,
          options: [],
          validation: {},
        },
      ],
    },
  ],
};

describe("GET /api/forms/schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna perguntas da Attend para usuário Attend", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "u1",
        email: "attend@formsis.local",
        role: "COMERCIAL",
        name: "Attend",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    loadTenantFormSchemaByCompanyIdMock.mockResolvedValue(attendSchema);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.company.slug).toBe("attend");
    expect(body.blocks[0].key).toBe("bloco1");
    expect(body.blocks[0].questions[0].fieldId).toBe("cenario_atual_conectividade");
  });

  it("retorna perguntas da V8 para usuário V8", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "u2",
        email: "v8@formsis.local",
        role: "COMERCIAL",
        name: "V8",
        activeCompanyId: "c_v8",
        activeCompany: { id: "c_v8", name: "V8", slug: "v8" },
      },
    });
    loadTenantFormSchemaByCompanyIdMock.mockResolvedValue(v8Schema);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.company.slug).toBe("v8");
    expect(body.blocks[0].questions[0].fieldId).toBe("objetivo_de_conectividade_v8");
  });

  it("não retorna bloco interno para perfil sem permissão", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "u3",
        email: "comercial@formsis.local",
        role: "COMERCIAL",
        name: "Comercial",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    loadTenantFormSchemaByCompanyIdMock.mockResolvedValue(attendSchema);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.blocks.some((block: { key: string }) => block.key === "bloco21")).toBe(false);
  });

  it("retorna bloco interno para PRE_VENDAS/ADMIN", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "u4",
        email: "prevendas@formsis.local",
        role: "PRE_VENDAS",
        name: "Pre-vendas",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    loadTenantFormSchemaByCompanyIdMock.mockResolvedValue(attendSchema);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.blocks.some((block: { key: string }) => block.key === "bloco21")).toBe(true);
  });

  it("rejeita request sem autenticação", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }),
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(loadTenantFormSchemaByCompanyIdMock).not.toHaveBeenCalled();
  });

  it("retorna blocos e perguntas ordenados", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "u5",
        email: "ordenacao@formsis.local",
        role: "ADMIN",
        name: "Admin",
        activeCompanyId: "c_attend",
        activeCompany: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    loadTenantFormSchemaByCompanyIdMock.mockResolvedValue(attendSchema);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.blocks.map((block: { key: string }) => block.key)).toEqual([
      "bloco1",
      "bloco21",
    ]);
    expect(body.blocks[0].questions.map((question: { fieldId: string }) => question.fieldId)).toEqual([
      "cenario_atual_conectividade",
      "escopo_unidades",
    ]);
  });
});
