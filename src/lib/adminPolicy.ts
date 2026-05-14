import { db } from "@/lib/db";
import type { UserRole } from "@/lib/auth";

/** Garante que pelo menos um ADMIN ativo permanece. */
export async function assertNotLastActiveAdmin(
  userId: string,
  next: { role?: UserRole; active?: boolean },
) {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== "ADMIN" || !u.active) return { ok: true as const };

  const wouldLoseAdmin =
    (next.role !== undefined && next.role !== "ADMIN") ||
    (next.active !== undefined && next.active === false);

  if (!wouldLoseAdmin) return { ok: true as const };

  const otherAdmins = await db.user.count({
    where: { role: "ADMIN", active: true, id: { not: userId } },
  });
  if (otherAdmins < 1) {
    return {
      ok: false as const,
      message: "É obrigatório manter pelo menos um administrador ativo.",
    };
  }
  return { ok: true as const };
}

/** Perfis operacionais devem ter pelo menos uma empresa vinculada. */
export function assertOperationalUserHasCompany(
  role: UserRole,
  companyIds: string[] | undefined | null,
) {
  if (role === "SUPER_ADMIN") return { ok: true as const };
  if (!companyIds || companyIds.length === 0) {
    return {
      ok: false as const,
      message: "Usuarios que nao sao SUPER_ADMIN devem ter ao menos uma empresa vinculada.",
    };
  }
  return { ok: true as const };
}
