import { z } from "zod";

const blockKeyRegex = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const fieldIdRegex = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

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

const collisionStrategyValues = ["replace", "skip", "rename"] as const;

const optionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
});

const questionSchema = z.object({
  fieldId: z.string().trim().min(1).max(60).regex(fieldIdRegex),
  label: z.string().trim().min(1).max(160),
  type: z.enum(questionTypeValues),
  requiredDefault: z.boolean().optional(),
  options: z.array(optionSchema).max(50).optional(),
  order: z.number().int().min(0).max(9999),
});

const blockSchema = z.object({
  blockKey: z.string().trim().min(1).max(80).regex(blockKeyRegex),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  order: z.number().int().min(0).max(9999),
  strategy: z.enum(collisionStrategyValues),
  questions: z.array(questionSchema).min(1).max(200),
});

export const commitImportBodySchema = z.object({
  companyId: z.string().trim().min(1).max(64).optional(),
  blocks: z.array(blockSchema).min(1).max(50),
});

export type CommitImportBody = z.infer<typeof commitImportBodySchema>;
export type CommitImportBlock = z.infer<typeof blockSchema>;
export type CommitImportQuestion = z.infer<typeof questionSchema>;
export type CollisionStrategy = (typeof collisionStrategyValues)[number];
