export type ParsedQuestionType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "boolean";

export type ParsedQuestionOption = { label: string; value: string };

export type ParsedQuestion = {
  fieldId: string;
  label: string;
  type: ParsedQuestionType;
  options?: ParsedQuestionOption[];
  order: number;
};

export type ParsedBlock = {
  blockKey: string;
  title: string;
  order: number;
  questions: ParsedQuestion[];
};

const ITEM_REGEX = /^(\d+)\.\s+(.+?)$/;

const YES_NO_OPTIONS: ParsedQuestionOption[] = [
  { label: "Sim", value: "sim" },
  { label: "Nao", value: "nao" },
];

const YES_NO_STARTERS = [
  "existe",
  "existem",
  "ha",
  "possui",
  "tem",
  "o ambiente",
  "o projeto",
  "o local",
  "o modelo",
  "a solucao",
  "a operacao",
  "envolve",
  "sera",
];

const NUMBER_STARTERS = ["quanto", "quantos", "quantas", "quantidade"];

const SHORT_TEXT_KEYWORDS = [
  "razao social",
  "endereco",
  "site",
  "contato",
  "responsavel",
  "operadora",
  "razao",
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function toSlug(value: string, maxLength = 60): string {
  const ascii = stripAccents(value).toLowerCase();
  const cleaned = ascii
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return cleaned.slice(0, maxLength).replace(/_+$/g, "");
}

export function suggestQuestionType(label: string): {
  type: ParsedQuestionType;
  options?: ParsedQuestionOption[];
} {
  const normalized = stripAccents(label.trim().toLowerCase());

  if (NUMBER_STARTERS.some((word) => normalized.startsWith(word + " "))) {
    return { type: "number" };
  }

  if (YES_NO_STARTERS.some((word) => normalized.startsWith(word + " "))) {
    return { type: "radio", options: YES_NO_OPTIONS };
  }

  if (SHORT_TEXT_KEYWORDS.some((word) => normalized.includes(word))) {
    return { type: "text" };
  }

  if (normalized.endsWith("?")) {
    return { type: "textarea" };
  }

  return { type: "text" };
}

type RawItem = { num: number; text: string };

function normalizeForItems(rawText: string): string {
  // Insert newline before every "<digit>. " sequence so layouts where unpdf joins
  // everything into a single line still produce one item per line. Skip cases that
  // look like decimals (e.g. "1.5") by requiring a space after the dot.
  return rawText.replace(/(\d{1,3})\.\s+/g, "\n$1. ");
}

const MAX_ITEM_TEXT_LENGTH = 160;
const ENDS_WITH_TERMINAL_PUNCT = /[?!.]$/;

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

function collectItems(rawText: string): RawItem[] {
  const lines = normalizeForItems(rawText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const items: RawItem[] = [];
  let current: RawItem | null = null;

  for (const line of lines) {
    const match = ITEM_REGEX.exec(line);
    if (match) {
      if (current) items.push(current);
      current = { num: Number(match[1]), text: match[2].trim() };
    } else if (current) {
      // Stop concatenating trailing footer/disclaimer text after a complete sentence,
      // and never let an item label grow past the schema cap.
      if (ENDS_WITH_TERMINAL_PUNCT.test(current.text)) continue;
      if (current.text.length >= MAX_ITEM_TEXT_LENGTH) continue;
      current.text = `${current.text} ${line}`.trim();
    }
  }
  if (current) items.push(current);

  return items.map((item) => ({
    num: item.num,
    text: truncateAtWord(item.text, MAX_ITEM_TEXT_LENGTH),
  }));
}

function ensureUniqueKey(base: string, used: Set<string>): string {
  if (!used.has(base) && base.length > 0) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  let candidate = `${base || "item"}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base || "item"}_${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

export function parseBlocksFromText(rawText: string): ParsedBlock[] {
  const items = collectItems(rawText);

  const blocks: ParsedBlock[] = [];
  const usedBlockKeys = new Set<string>();

  let currentBlock: ParsedBlock | null = null;
  let usedFieldIds = new Set<string>();
  let expectedQuestion = 1;
  let blockOrder = 1;

  const startNewBlock = (item: RawItem): ParsedBlock => {
    const blockKeyBase = toSlug(item.text, 60) || `bloco_${blockOrder}`;
    const blockKey = ensureUniqueKey(blockKeyBase, usedBlockKeys);
    const next: ParsedBlock = {
      blockKey,
      title: item.text,
      order: blockOrder,
      questions: [],
    };
    usedFieldIds = new Set<string>();
    expectedQuestion = 1;
    blockOrder += 1;
    blocks.push(next);
    return next;
  };

  for (const item of items) {
    if (!currentBlock) {
      currentBlock = startNewBlock(item);
      continue;
    }

    if (item.num === expectedQuestion) {
      const { type, options } = suggestQuestionType(item.text);
      const fieldIdBase = toSlug(item.text, 50) || `pergunta_${expectedQuestion}`;
      const fieldId = ensureUniqueKey(fieldIdBase, usedFieldIds);
      currentBlock.questions.push({
        fieldId,
        label: item.text,
        type,
        options,
        order: expectedQuestion,
      });
      expectedQuestion += 1;
    } else {
      currentBlock = startNewBlock(item);
    }
  }

  return blocks;
}

export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}

export async function parseBlocksFromPdfBuffer(buffer: ArrayBuffer): Promise<ParsedBlock[]> {
  const text = await extractTextFromPdfBuffer(buffer);
  return parseBlocksFromText(text);
}
