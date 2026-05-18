import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    company: { findUnique: vi.fn() },
    formBlock: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { loadTenantFormSchemaByCompanyId } from "./formSchemaService";
import { db } from "@/lib/db";

const dbMock = db as unknown as {
  company: { findUnique: ReturnType<typeof vi.fn> };
  formBlock: { findMany: ReturnType<typeof vi.fn> };
};

describe("loadTenantFormSchemaByCompanyId - isolamento por empresa + dono", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.company.findUnique.mockResolvedValue({
      id: "c_v8",
      name: "V8",
      slug: "v8",
      active: true,
    });
  });

  it("filtra blocos por companyId + ownerId + active", async () => {
    dbMock.formBlock.findMany.mockResolvedValue([]);

    await loadTenantFormSchemaByCompanyId("c_v8", "gean");

    const args = dbMock.formBlock.findMany.mock.calls[0][0] as {
      where: { companyId: string; ownerId: string; active: boolean };
    };
    expect(args.where).toEqual({ companyId: "c_v8", ownerId: "gean", active: true });
  });

  it("Gean na V8 recebe apenas os blocos de Gean", async () => {
    dbMock.formBlock.findMany.mockResolvedValue([
      {
        id: "b_gean_1",
        blockKey: "bloco_gean",
        title: "Bloco do Gean",
        description: null,
        order: 1,
        questions: [
          {
            id: "q1",
            fieldId: "campo_gean",
            label: "Campo Gean",
            type: "text",
            order: 1,
            placeholder: null,
            helpText: null,
            requiredDefault: false,
            optionsJson: null,
            validationJson: null,
          },
        ],
      },
    ]);

    const schema = await loadTenantFormSchemaByCompanyId("c_v8", "gean");

    expect(schema?.blocks).toHaveLength(1);
    expect(schema?.blocks[0].key).toBe("bloco_gean");
  });

  it("Fulano na V8 sem blocos proprios recebe schema vazio", async () => {
    dbMock.formBlock.findMany.mockResolvedValue([]);

    const schema = await loadTenantFormSchemaByCompanyId("c_v8", "fulano");

    expect(schema?.blocks).toEqual([]);
  });
});
