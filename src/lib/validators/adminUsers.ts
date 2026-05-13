import { z } from "zod";

export const createUserBodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(200),
  role: z.enum(["ADMIN", "COMERCIAL", "PRE_VENDAS", "LEITURA"]),
  companyId: z.string().min(1).max(64).optional(),
});

export const patchUserBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().max(255).toLowerCase().optional(),
    role: z.enum(["ADMIN", "COMERCIAL", "PRE_VENDAS", "LEITURA"]).optional(),
    companyId: z.string().min(1).max(64).optional(),
    active: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), {
    message: "Nenhum campo para atualizar.",
  });
