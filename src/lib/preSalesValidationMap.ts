import type { PreSalesChecklist } from "@/lib/preSalesMeta";

export type ChecklistKey = keyof PreSalesChecklist;

export type ValidationEvidence = {
  block: string;
  fields: Array<{ id: string; label: string }>;
};

export const preSalesValidationMap: Record<ChecklistKey, ValidationEvidence[]> = {
  scopeValidated: [
    {
      block: "Bloco 1 — Contexto da demanda",
      fields: [
        { id: "nome_interno_solicitacao", label: "Nome interno da solicitacao" },
        { id: "tipo_solucao_desejada", label: "Tipo de solucao desejada" },
        { id: "urgencia", label: "Urgencia" },
        { id: "data_desejada_implantacao", label: "Data desejada para implantacao" },
        { id: "origem_demanda", label: "Origem da demanda" },
      ],
    },
    {
      block: "Bloco 4 — Objetivo da solucao",
      fields: [
        { id: "objetivo_principal_link", label: "Objetivo principal do link" },
        { id: "problemas_atuais_motivam", label: "Problemas atuais que motivam" },
        { id: "impacto_dor", label: "Impacto da dor" },
      ],
    },
  ],
  technicalFeasibilityValidated: [
    {
      block: "Bloco 3 — Caracteristicas do site",
      fields: [
        { id: "ambiente", label: "Ambiente" },
        { id: "tipo_local", label: "Tipo de local" },
        { id: "restricoes_acesso_local", label: "Restricoes de acesso ao local" },
        { id: "restricao_trabalho_altura", label: "Restricao de trabalho em altura" },
      ],
    },
    {
      block: "Bloco 7 — Conectividade atual",
      fields: [
        { id: "tecnologia_atual", label: "Tecnologia atual" },
        { id: "conexao_atual_atende", label: "Conexao atual atende" },
        { id: "deseja_solucao_hibrida", label: "Deseja solucao hibrida" },
      ],
    },
  ],
  sizingValidated: [
    {
      block: "Bloco 5 — Aplicacoes e trafego",
      fields: [
        { id: "voip", label: "VoIP" },
        { id: "aplicacoes_sensiveis_a_latencia", label: "Aplicacoes sensiveis a latencia" },
        { id: "sistemas_criticos_em_tempo_real", label: "Sistemas criticos em tempo real" },
      ],
    },
    {
      block: "Bloco 6 — Usuarios e crescimento",
      fields: [
        { id: "qtd_usuarios_simultaneos", label: "Usuarios simultaneos" },
        { id: "qtd_dispositivos_simultaneos", label: "Dispositivos simultaneos" },
        { id: "expectativa_aumento_usuarios", label: "Expectativa de aumento de usuarios" },
      ],
    },
  ],
  slaValidated: [
    {
      block: "Bloco 1 — Contexto da demanda",
      fields: [
        { id: "prazo_contratual_imposto_cliente", label: "Prazo contratual imposto" },
        { id: "urgencia", label: "Urgencia" },
      ],
    },
    {
      block: "Bloco 16 — SLA e monitoramento",
      fields: [
        { id: "horario_suporte_desejado", label: "Horario de suporte desejado" },
        { id: "o_cliente_deseja_monitoramento", label: "Cliente deseja monitoramento" },
        { id: "ha_necessidade_de_relatorio_operacional", label: "Necessidade de relatorio operacional" },
      ],
    },
  ],
  risksValidated: [
    {
      block: "Bloco 3 — Caracteristicas do site",
      fields: [
        { id: "risco_vandalismo", label: "Risco de vandalismo" },
        { id: "risco_ambiental", label: "Risco ambiental" },
        { id: "observacoes_local", label: "Observacoes do local" },
      ],
    },
    {
      block: "Bloco 17 — Logistica em local remoto",
      fields: [
        { id: "local_remoto", label: "Local remoto" },
        { id: "ha_necessidade_de_veiculo_especial", label: "Necessidade de veiculo especial" },
        { id: "ha_necessidade_de_mais_de_uma_visita", label: "Necessidade de mais de uma visita" },
      ],
    },
  ],
  complianceValidated: [
    {
      block: "Bloco 10 — Seguranca",
      fields: [
        { id: "compliance_especifico", label: "Compliance especifico" },
        { id: "ha_exigencia_de_whitelist_por_ip", label: "Exigencia de whitelist por IP" },
        { id: "ha_exigencia_de_retencao_de_logs", label: "Retencao de logs" },
      ],
    },
    {
      block: "Bloco 11 — VPN",
      fields: [
        { id: "cliente_usa_vpn", label: "Cliente usa VPN" },
        { id: "ha_restricao_de_nat_cgnat", label: "Restricao de NAT/CGNAT" },
        { id: "ha_necessidade_de_teste_de_homologacao", label: "Necessidade de teste de homologacao" },
      ],
    },
  ],
};

/** Campos vazios no quadro técnico mapeado (UI e validação na aprovação técnica). */
export function listMissingMappedEvidence(
  payload: Record<string, string>,
  allowedFieldIds?: Set<string>,
): string[] {
  return (Object.keys(preSalesValidationMap) as ChecklistKey[]).flatMap((k) =>
    preSalesValidationMap[k].flatMap((g) =>
      g.fields
        .filter((f) => (!allowedFieldIds || allowedFieldIds.has(f.id)) && !String(payload[f.id] ?? "").trim())
        .map((f) => `${g.block} · ${f.label}`),
    ),
  );
}

export function listMissingMappedFieldIds(
  payload: Record<string, string>,
  allowedFieldIds?: Set<string>,
): string[] {
  const ids = (Object.keys(preSalesValidationMap) as ChecklistKey[]).flatMap((k) =>
    preSalesValidationMap[k].flatMap((g) =>
      g.fields
        .filter((f) => (!allowedFieldIds || allowedFieldIds.has(f.id)) && !String(payload[f.id] ?? "").trim())
        .map((f) => f.id),
    ),
  );
  return Array.from(new Set(ids));
}
