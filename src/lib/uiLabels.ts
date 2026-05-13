/** Rotulos em portugues para estados e perfis exibidos na interface. */

export function statusPropostaPt(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    IN_PROGRESS: "Em andamento",
    PAUSED: "Pausada",
    FINALIZED: "Finalizada",
    ARCHIVED: "Arquivada",
  };
  return map[status] ?? status;
}

export function perfilUsuarioPt(role: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super administracao",
    ADMIN: "Administracao",
    COMERCIAL: "Comercial",
    PRE_VENDAS: "Pre-vendas",
    LEITURA: "Somente leitura",
  };
  return map[role] ?? role;
}

export function etapaPreVendasPt(stage: string) {
  const map: Record<string, string> = {
    DRAFTING: "Em preparacao comercial",
    UNDER_PRE_SALES_REVIEW: "Em validacao tecnica (Pre-vendas)",
    CHANGES_REQUESTED: "Ajustes solicitados pelo Pre-vendas",
    APPROVED_PRE_SALES: "Parecer tecnico aprovado",
  };
  return map[stage] ?? stage;
}
