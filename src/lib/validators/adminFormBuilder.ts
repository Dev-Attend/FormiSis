import { z } from "zod";

const blockKeyRegex = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

const questionTypeValues = [
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "boolean",
] as const;

const questionOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
});

export const questionTypeSchema = z.enum(questionTypeValues);

export const createFormBlockBodySchema = z.object({
  companyId: z.string().trim().min(1).max(64).optional(),
  blockKey: z.string().trim().min(1).max(80).regex(blockKeyRegex),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  order: z.number().int().min(0).max(9999),
  active: z.boolean().optional(),
});

export const patchFormBlockBodySchema = z
  .object({
    blockKey: z.string().trim().min(1).max(80).regex(blockKeyRegex).optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    order: z.number().int().min(0).max(9999).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Nenhum campo para atualizar.",
  });

export const createFormQuestionBodySchema = z.object({
  label: z.string().trim().min(1).max(160),
  type: questionTypeSchema,
  requiredDefault: z.boolean().optional(),
  placeholder: z.string().trim().max(240).optional().nullable(),
  helpText: z.string().trim().max(500).optional().nullable(),
  options: z.array(questionOptionSchema).max(200).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  order: z.number().int().min(0).max(9999),
  active: z.boolean().optional(),
});

export const patchFormQuestionBodySchema = z
  .object({
    label: z.string().trim().min(1).max(160).optional(),
    type: questionTypeSchema.optional(),
    requiredDefault: z.boolean().optional(),
    placeholder: z.string().trim().max(240).optional().nullable(),
    helpText: z.string().trim().max(500).optional().nullable(),
    options: z.array(questionOptionSchema).max(200).optional(),
    validation: z.record(z.string(), z.unknown()).optional(),
    order: z.number().int().min(0).max(9999).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Nenhum campo para atualizar.",
  });
