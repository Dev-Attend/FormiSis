import { describe, expect, it } from "vitest";
import {
  parseBlocksFromText,
  suggestQuestionType,
  type ParsedBlock,
} from "./blockParser";

const V8_SAMPLE = `V8 Soluções
Questionário Executivo — Levantamento Estratégico
SD-WAN + Starlink
Este documento tem como objetivo realizar o levantamento estratégico e técnico inicial do ambiente corporativo,
permitindo entendimento operacional, definição da arquitetura da solução e elaboração da proposta
técnico-comercial.
1. Informações Corporativas
1. Razão Social da empresa
2. Segmento de atuação
3. Quantidade de unidades/filiais
4. Endereço da matriz
5. Responsável pelo projeto
6. Contato técnico
7. Contato comercial
8. Quantidade aproximada de colaboradores
9. Site institucional
10. Região de atuação da operação
2. Objetivo da Solução
1. Qual o principal objetivo da contratação?
2. Existe necessidade de alta disponibilidade?
3. A solução será principal ou contingência?
4. Existe necessidade de expansão operacional?
5. O projeto envolve modernização da rede atual?
6. Existe necessidade de continuidade operacional 24x7?
7. Existe necessidade de gestão centralizada?
8. Existe criticidade operacional relacionada à conectividade?
9. Existe necessidade de escalabilidade futura?
10. Existe prazo estratégico para implantação?
`;

describe("suggestQuestionType", () => {
  it("treats 'Existe ...?' as yes/no radio", () => {
    const result = suggestQuestionType("Existe necessidade de alta disponibilidade?");
    expect(result.type).toBe("radio");
    expect(result.options).toEqual([
      { label: "Sim", value: "sim" },
      { label: "Nao", value: "nao" },
    ]);
  });

  it("treats 'Existem ...?' as yes/no radio", () => {
    const result = suggestQuestionType("Existem filiais em regiões remotas?");
    expect(result.type).toBe("radio");
  });

  it("treats 'Quantos ...?' as number", () => {
    const result = suggestQuestionType("Quantos sites/unidades participarão do projeto?");
    expect(result.type).toBe("number");
  });

  it("treats 'Quantidade ...' as number", () => {
    const result = suggestQuestionType("Quantidade aproximada de colaboradores");
    expect(result.type).toBe("number");
  });

  it("treats short identity fields as text", () => {
    expect(suggestQuestionType("Razão Social da empresa").type).toBe("text");
    expect(suggestQuestionType("Endereço da matriz").type).toBe("text");
    expect(suggestQuestionType("Site institucional").type).toBe("text");
    expect(suggestQuestionType("Contato técnico").type).toBe("text");
    expect(suggestQuestionType("Responsável pelo projeto").type).toBe("text");
  });

  it("falls back to textarea for open questions ending in '?'", () => {
    const result = suggestQuestionType("Qual o principal objetivo da contratação?");
    expect(result.type).toBe("textarea");
  });

  it("falls back to text for short label without '?'", () => {
    const result = suggestQuestionType("Segmento de atuação");
    expect(result.type).toBe("text");
  });
});

describe("parseBlocksFromText", () => {
  const blocks: ParsedBlock[] = parseBlocksFromText(V8_SAMPLE);

  it("identifies the two blocks present in the sample", () => {
    expect(blocks).toHaveLength(2);
  });

  it("uses the section heading as the block title", () => {
    expect(blocks[0].title).toBe("Informações Corporativas");
    expect(blocks[1].title).toBe("Objetivo da Solução");
  });

  it("generates slugified block keys", () => {
    expect(blocks[0].blockKey).toBe("informacoes_corporativas");
    expect(blocks[1].blockKey).toBe("objetivo_da_solucao");
  });

  it("orders blocks starting at 1", () => {
    expect(blocks[0].order).toBe(1);
    expect(blocks[1].order).toBe(2);
  });

  it("collects all 10 questions per block", () => {
    expect(blocks[0].questions).toHaveLength(10);
    expect(blocks[1].questions).toHaveLength(10);
  });

  it("preserves question labels and orders", () => {
    expect(blocks[0].questions[0].label).toBe("Razão Social da empresa");
    expect(blocks[0].questions[0].order).toBe(1);
    expect(blocks[0].questions[9].label).toBe("Região de atuação da operação");
    expect(blocks[0].questions[9].order).toBe(10);
  });

  it("applies type heuristics within a block", () => {
    const block1Types = blocks[0].questions.map((q) => q.type);
    expect(block1Types).toContain("text");
    expect(block1Types).toContain("number");

    const block2Types = blocks[1].questions.map((q) => q.type);
    expect(block2Types.filter((t) => t === "radio").length).toBeGreaterThan(5);
  });

  it("generates unique fieldIds within a block", () => {
    for (const block of blocks) {
      const ids = block.questions.map((q) => q.fieldId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });

  it("skips PDF preamble that doesn't match the item pattern", () => {
    expect(blocks[0].title).not.toMatch(/V8 Soluções|Questionário Executivo/);
  });

  it("handles line wraps inside a question by concatenating", () => {
    const wrapped = `1. Bloco A
1. Pergunta com texto
muito longo que quebra linha?
2. Outra pergunta?
`;
    const parsed = parseBlocksFromText(wrapped);
    expect(parsed[0].questions).toHaveLength(2);
    expect(parsed[0].questions[0].label).toBe(
      "Pergunta com texto muito longo que quebra linha?",
    );
  });

  it("returns empty array when input has no numbered items", () => {
    expect(parseBlocksFromText("just some prose\nno numbers here")).toEqual([]);
  });

  it("parses text that arrives without newlines between items", () => {
    const flat =
      "1. Informações Corporativas 1. Razão Social da empresa 2. Segmento de atuação 3. Quantidade de unidades/filiais 2. Objetivo da Solução 1. Qual o principal objetivo?";
    const parsed = parseBlocksFromText(flat);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("Informações Corporativas");
    expect(parsed[0].questions).toHaveLength(3);
    expect(parsed[1].title).toBe("Objetivo da Solução");
    expect(parsed[1].questions).toHaveLength(1);
  });

  it("ignores decimals like '1.5' inside text (no space after dot)", () => {
    const text = "1. Bloco\n1. Limite de 1.5 GB por usuário?";
    const parsed = parseBlocksFromText(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].questions).toHaveLength(1);
    expect(parsed[0].questions[0].label).toBe("Limite de 1.5 GB por usuário?");
  });

  it("does not append PDF footer/disclaimer text to the last question", () => {
    const text = `1. Modelo Comercial
1. O modelo desejado é aquisição, locação ou serviço gerenciado?
2. Existe budget previsto?
V8 Soluções — Secure Connectivity
Conectividade corporativa inteligente com foco em disponibilidade, segurança e continuidade operacional.`;
    const parsed = parseBlocksFromText(text);
    expect(parsed).toHaveLength(1);
    const lastQuestion = parsed[0].questions[parsed[0].questions.length - 1];
    expect(lastQuestion.label).toBe("Existe budget previsto?");
    expect(lastQuestion.label.length).toBeLessThanOrEqual(160);
  });

  it("caps any item label at 160 characters even if continuation grows it", () => {
    const longTail = "palavra ".repeat(40);
    const text = `1. Bloco\n1. Pergunta inicial sem ponto final\n${longTail}\n2. Outra pergunta?`;
    const parsed = parseBlocksFromText(text);
    for (const block of parsed) {
      for (const question of block.questions) {
        expect(question.label.length).toBeLessThanOrEqual(160);
      }
    }
  });
});
