import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    company: { findUnique: vi.fn() },
    formBlock: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    formQuestion: { deleteMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { POST } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const dbMock = db as unknown as {
  company: { findUnique: ReturnType<typeof vi.fn> };
  formBlock: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  formQuestion: {
    deleteMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

function importRequest() {
  return new NextRequest("http://localhost:3001/api/admin/form-blocks/import/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          blockKey: "informacoes_corporativas",
          title: "Informacoes corporativas",
          order: 1,
          strategy: "skip",
          questions: [
            { fieldId: "razao_social", label: "Razao social", type: "text", order: 1 },
          ],
        },
      ],
    }),
  });
}

describe("POST /api/admin/form-blocks/import/commit - isolamento por dono", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "gean",
        email: "gean@v8.local",
        role: "ADMIN",
        name: "Gean",
        activeCompanyId: "c_v8",
        activeCompany: { id: "c_v8", name: "V8", slug: "v8" },
      },
    });
    dbMock.company.findUnique.mockResolvedValue({ id: "c_v8", active: true });
    dbMock.auditLog.create.mockResolvedValue({ id: "a1" });
  });

  it("colisao considera apenas blocos do proprio usuario e cria com ownerId", async () => {
    // Banco so retorna blocos do proprio usuario (query escopada por ownerId).
    dbMock.formBlock.findMany.mockResolvedValue([]);
    dbMock.formBlock.create.mockResolvedValue({
      id: "b_new",
      blockKey: "informacoes_corporativas",
    });
    dbMock.formQuestion.create.mockResolvedValue({ id: "q_new" });

    const response = await POST(importRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0].status).toBe("created");

    const findManyArgs = dbMock.formBlock.findMany.mock.calls[0][0] as {
      where: { companyId: string; ownerId: string };
    };
    expect(findManyArgs.where.ownerId).toBe("gean");

    const createArgs = dbMock.formBlock.create.mock.calls[0][0] as {
      data: { ownerId: string; companyId: string };
    };
    expect(createArgs.data.ownerId).toBe("gean");
    expect(createArgs.data.companyId).toBe("c_v8");
  });

  it("mesmo blockKey do proprio usuario gera colisao (skip)", async () => {
    dbMock.formBlock.findMany.mockResolvedValue([
      { blockKey: "informacoes_corporativas" },
    ]);

    const response = await POST(importRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0].status).toBe("skipped");
    expect(dbMock.formBlock.create).not.toHaveBeenCalled();
  });
});
