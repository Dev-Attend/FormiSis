import { z } from "zod";

const companyIdsSchema = z
  .array(z.string().min(1).max(64))
  .max(50)
  .optional()
  .transform((value) => (value ? Array.from(new Set(value)) : value));

export const createUserBodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "COMERCIAL", "PRE_VENDAS", "LEITURA"]),
  companyIds: companyIdsSchema,
});

export const patchUserBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().max(255).toLowerCase().optional(),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "COMERCIAL", "PRE_VENDAS", "LEITURA"]).optional(),
    companyIds: companyIdsSchema,
    active: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Nenhum campo para atualizar.",
  });
