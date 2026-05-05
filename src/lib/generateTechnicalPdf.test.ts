import { describe, expect, it } from "vitest";
import { generateTechnicalPdf } from "./generateTechnicalPdf";

describe("generateTechnicalPdf", () => {
  it("gera bytes PDF validos com texto PT e linhas longas", async () => {
    const pdf = await generateTechnicalPdf([
      "DOCUMENTO TECNICO AUTOMATICO - FORMSIS",
      "acao revisao parecer tecnico",
      "x".repeat(800),
    ]);
    expect(pdf.byteLength).toBeGreaterThan(400);
    const head = new TextDecoder("latin1").decode(pdf.slice(0, 8));
    expect(head.startsWith("%PDF-")).toBe(true);
  });
});
