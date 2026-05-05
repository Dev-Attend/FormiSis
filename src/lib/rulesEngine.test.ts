import { describe, expect, it } from "vitest";
import { avaliarRegras } from "./rulesEngine";

describe("rulesEngine", () => {
  it("bloqueia urgencia sem justificativa", () => {
    const rules = avaliarRegras({
      urgencia: "urgente",
      justificativa_urgencia: "",
      quantidade_sites_escopo: "1",
      ambiente: "urbano",
      link_principal_ou_complementar: "principal",
      horario_suporte_desejado: "horario comercial",
      data_desejada_implantacao: "2026-12-01",
      complexidade_tecnica: "baixa",
    });
    expect(rules.errors.some((e) => e.includes("Urgencia"))).toBe(true);
  });

  it("sinaliza vpn com nat/cgnat para parecer tecnico", () => {
    const rules = avaliarRegras({
      urgencia: "normal",
      justificativa_urgencia: "",
      quantidade_sites_escopo: "1",
      ambiente: "urbano",
      link_principal_ou_complementar: "principal",
      horario_suporte_desejado: "horario comercial",
      data_desejada_implantacao: "2026-12-01",
      complexidade_tecnica: "baixa",
      cliente_usa_vpn: "sim",
      ha_restricao_de_nat_cgnat: "sim",
    });
    expect(rules.warnings.some((e) => e.includes("NAT/CGNAT"))).toBe(true);
  });

  it("operacao critica usa ids reais do schema (horario de suporte)", () => {
    const base = {
      urgencia: "normal",
      justificativa_urgencia: "",
      quantidade_sites_escopo: "1",
      ambiente: "urbano",
      link_principal_ou_complementar: "principal",
      data_desejada_implantacao: "2026-12-01",
      complexidade_tecnica: "baixa",
      link_contingencia_critica: "sim",
      tensao_disponivel: "220",
      ha_nobreak: "sim",
      o_cliente_deseja_monitoramento: "sim",
      horario_suporte_desejado: "horario comercial",
    };
    const rules = avaliarRegras(base as Record<string, string>);
    expect(rules.requiredFields.has("horario_de_suporte_desejado")).toBe(false);
    expect(rules.requiredFields.has("horario_suporte_desejado")).toBe(true);
    expect(
      Array.from(rules.requiredFields).filter((fid) => !String((base as Record<string, string>)[fid] ?? "").trim()),
    ).toHaveLength(0);
  });

  it("local remoto usa ids reais para diarias e prazo logistico", () => {
    const base = {
      urgencia: "normal",
      justificativa_urgencia: "",
      quantidade_sites_escopo: "1",
      ambiente: "urbano",
      link_principal_ou_complementar: "principal",
      horario_suporte_desejado: "horario comercial",
      data_desejada_implantacao: "2026-12-01",
      complexidade_tecnica: "baixa",
      local_remoto: "sim",
      ha_acesso_por_estrada_precaria: "nao",
      ha_necessidade_de_veiculo_especial: "nao",
      ha_necessidade_de_hospedagem: "nao",
      ha_necessidade_de_transporte_aereo_fluvial: "nao",
      ha_restricao_de_entrada_de_materiais: "nao",
      ha_necessidade_de_agendamento_com_antecedencia: "nao",
      ha_necessidade_de_documentacao_de_equipe: "nao",
      ha_necessidade_de_epi_especifico: "nao",
      ha_necessidade_de_equipe_adicional: "nao",
      ha_necessidade_de_mais_de_uma_visita: "nao",
      ha_janela_curta_para_execucao: "nao",
      ha_necessidade_de_mobilizacao_especial: "nao",
      qtd_estimadas_diarias: "2",
      prazo_logistico_estimado: "10 dias",
    };
    const rules = avaliarRegras(base as Record<string, string>);
    expect(rules.requiredFields.has("quantidade_estimada_de_diarias")).toBe(false);
    expect(rules.requiredFields.has("prazo_logistico_estimado_conhecido")).toBe(false);
    expect(
      Array.from(rules.requiredFields).filter((fid) => !String((base as Record<string, string>)[fid] ?? "").trim()),
    ).toHaveLength(0);
  });
});
