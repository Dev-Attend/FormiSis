import { toFieldId, type Block, type Field, type FieldType, type Option } from "@/lib/formSchema";

type UnknownRecord = Record<string, unknown>;

export type TenantSchemaQuestion = {
  id: string;
  fieldId: string;
  label: string;
  type: FieldType;
  order: number;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  options: Option[];
  validation: UnknownRecord;
};

export type TenantSchemaBlock = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  order: number;
  questions: TenantSchemaQuestion[];
};

export type TenantSchemaCompany = {
  id: string;
  name: string;
  slug: string;
};

export type TenantSchemaResponse = {
  company: TenantSchemaCompany;
  blocks: TenantSchemaBlock[];
};

const fieldTypes: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "email",
  "tel",
];

export function normalizeFieldType(type: string): FieldType {
  if (fieldTypes.includes(type as FieldType)) {
    return type as FieldType;
  }
  return "text";
}

export function parseOptionsJson(raw?: string | null): Option[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === "object" && item !== null)
      .map((item) => {
        const entry = item as { label?: unknown; value?: unknown };
        return {
          label: String(entry.label ?? ""),
          value: String(entry.value ?? ""),
        };
      })
      .filter((entry) => entry.label.trim() && entry.value.trim());
  } catch {
    return [];
  }
}

export function parseValidationJson(raw?: string | null): UnknownRecord {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as UnknownRecord;
  } catch {
    return {};
  }
}

export function mapTenantBlocksToFormBlocks(blocks: TenantSchemaBlock[]): Block[] {
  return blocks.map((block) => ({
    id: block.key,
    key: block.key,
    title: block.title,
    description: block.description,
    order: block.order,
    fields: block.questions.map((question): Field => ({
      id: question.fieldId,
      label: question.label,
      type: normalizeFieldType(question.type),
      placeholder: question.placeholder ?? undefined,
      options: question.options,
      required: question.required,
    })),
  }));
}

export function mapLegacyBlocksToTenantBlocks(blocks: Block[]): TenantSchemaBlock[] {
  return blocks.map((block, blockIndex) => ({
    id: block.id,
    key: block.id,
    title: block.title,
    description: block.description ?? null,
    order: block.order ?? blockIndex + 1,
    questions: block.fields.map((field, fieldIndex) => ({
      id: `${block.id}:${field.id}`,
      fieldId: field.id || toFieldId(field.label),
      label: field.label,
      type: field.type,
      order: fieldIndex + 1,
      placeholder: field.placeholder ?? null,
      helpText: null,
      required: Boolean(field.required),
      options: field.options ?? [],
      validation: {},
    })),
  }));
}
