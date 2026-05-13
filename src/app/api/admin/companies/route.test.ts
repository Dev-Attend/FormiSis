import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    company: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { POST } from "./route";
import { requireApiAccess } from "@/lib/auth";
import { db } from "@/lib/db";

const requireApiAccessMock = vi.mocked(requireApiAccess);
const dbMock = db as {
  company: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
  };
};

describe("Admin companies route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN cria empresa", async () => {
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
    dbMock.company.create.mockResolvedValue({
      id: "c_v8",
      name: "V8",
      slug: "v8",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbMock.auditLog.create.mockResolvedValue({ id: "audit_company_1" });

    const request = new NextRequest("http://localhost:3001/api/admin/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "V8", slug: "v8" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.company.slug).toBe("v8");

    const createArgs = dbMock.company.create.mock.calls[0][0] as {
      data: { active: boolean };
    };
    expect(createArgs.data.active).toBe(true);
  });
});
