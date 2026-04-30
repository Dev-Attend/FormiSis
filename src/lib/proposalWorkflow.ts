import type { UserRole } from "@/lib/auth";

export type ProposalStatus = "DRAFT" | "IN_PROGRESS" | "PAUSED" | "FINALIZED" | "ARCHIVED";

const transitions: Record<ProposalStatus, ProposalStatus[]> = {
  /// Legado: rascunhos antigos ainda podem ser encerrados com documento.
  DRAFT: ["IN_PROGRESS", "FINALIZED", "ARCHIVED"],
  IN_PROGRESS: ["PAUSED", "FINALIZED", "ARCHIVED"],
  PAUSED: ["IN_PROGRESS", "FINALIZED", "ARCHIVED"],
  FINALIZED: ["ARCHIVED", "IN_PROGRESS"],
  ARCHIVED: [],
};

/**
 * Transicao de estado valida para o perfil. Reabertura pos-FINALIZED apenas para ADMIN.
 */
export function canTransition(
  from: ProposalStatus,
  to: ProposalStatus,
  role: UserRole,
): { ok: true } | { ok: false; reason: string } {
  if (from === to) return { ok: true };

  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Transicao nao permitida de ${from} para ${to}.`,
    };
  }

  if (from === "FINALIZED" && to === "IN_PROGRESS" && role !== "ADMIN") {
    return {
      ok: false,
      reason: "Apenas administrador pode reabrir proposta finalizada.",
    };
  }

  return { ok: true };
}

export function isTerminalStatus(status: ProposalStatus) {
  return status === "FINALIZED" || status === "ARCHIVED";
}
