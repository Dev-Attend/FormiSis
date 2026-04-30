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
    ADMIN: "Administração",
    COMERCIAL: "Comercial",
    PRE_VENDAS: "Pré-vendas",
    LEITURA: "Somente leitura",
  };
  return map[role] ?? role;
}

export function etapaPreVendasPt(stage: string) {
  const map: Record<string, string> = {
    DRAFTING: "Em preparação comercial",
    UNDER_PRE_SALES_REVIEW: "Em validação técnica (Pré-vendas)",
    CHANGES_REQUESTED: "Ajustes solicitados pelo Pré-vendas",
    APPROVED_PRE_SALES: "Parecer técnico aprovado",
  };
  return map[stage] ?? stage;
}
