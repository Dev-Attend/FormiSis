import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/proposalId", () => ({
  allocateUniqueProposalId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    formSession: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { POST } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { allocateUniqueProposalId } from "@/lib/proposalId";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const allocateUniqueProposalIdMock = vi.mocked(allocateUniqueProposalId);
const dbMock = db as {
  formSession: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe("POST /api/forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("salva payloadJson e warningsJson como string JSON serializada", async () => {
    requireApiAccessMock.mockResolvedValue({
      ok: true,
      user: {
        id: "u1",
        email: "comercial@formsis.local",
        role: "COMERCIAL",
        name: "Comercial",
        companyId: "c_attend",
        company: { id: "c_attend", name: "Attend", slug: "attend" },
      },
    });
    allocateUniqueProposalIdMock.mockResolvedValue("FORM-001");
    dbMock.formSession.create.mockResolvedValue({
      id: "FORM-001",
      revision: 1,
      status: "IN_PROGRESS",
    });

    const request = new NextRequest("http://localhost:3001/api/forms", {
      method: "POST",
      body: JSON.stringify({
        title: "Proposta teste",
        payload: { cenario_atual_conectividade: "Link instavel" },
        warnings: ["Alerta teste"],
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("FORM-001");

    expect(dbMock.formSession.create).toHaveBeenCalledTimes(1);
    const createArgs = dbMock.formSession.create.mock.calls[0][0] as {
      data: { payloadJson: unknown; warningsJson: unknown };
    };

    expect(typeof createArgs.data.payloadJson).toBe("string");
    expect(typeof createArgs.data.warningsJson).toBe("string");

    const parsedPayload = JSON.parse(createArgs.data.payloadJson as string) as Record<string, string>;
    const parsedWarnings = JSON.parse(createArgs.data.warningsJson as string) as string[];

    expect(parsedPayload.cenario_atual_conectividade).toBe("Link instavel");
    expect(parsedPayload.__preSalesMeta).toBeTypeOf("string");
    expect(parsedWarnings).toEqual(["Alerta teste"]);
  });
});

