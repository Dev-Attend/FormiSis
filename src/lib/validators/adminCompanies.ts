import { z } from "zod";

const companySlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCompanyBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(2).max(80).regex(companySlugRegex),
});

export const patchCompanyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(2).max(80).regex(companySlugRegex).optional(),
    active: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Nenhum campo para atualizar.",
  });
