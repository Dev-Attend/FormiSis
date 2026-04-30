import { toFieldId } from "./formSchema";

export type RulesResult = {
  errors: string[];
  warnings: string[];
  visibleBlocks: Set<string>;
  requiredFields: Set<string>;
};

const toNumber = (v: string) => Number(v || 0);
const isSim = (v: string) => v === "sim";
const id = (label: string) => toFieldId(label);
const get = (data: Record<string, string>, label: string) => data[id(label)] ?? "";

export function avaliarRegras(data: Record<string, string>): RulesResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const visibleBlocks = new Set<string>();
  const requiredFields = new Set<string>();
  const requireField = (fieldId: string, motivo?: string) => {
    requiredFields.add(fieldId);
    if (!String(data[fieldId] ?? "").trim()) {
      errors.push(motivo ?? `Campo obrigatorio nao preenchido: ${fieldId}`);
    }
  };

  for (let i = 1; i <= 20; i += 1) visibleBlocks.add(`bloco${i}`);
  visibleBlocks.delete("bloco12");
  visibleBlocks.delete("bloco17");
  visibleBlocks.delete("bloco19");

  if (["urgente", "emergencial"].includes(data.urgencia) && !data.justificativa_urgencia) {
    errors.push("Urgencia urgente/emergencial exige justificativa obrigatoria.");
    requiredFields.add("justificativa_urgencia");
  }

  if (toNumber(data.quantidade_sites_escopo) > 1) {
    visibleBlocks.add("bloco19");
    requireField("ms_qtd_total_sites", "Quantidade > 1 site exige bloco multi-site.");
  }

  if (["remoto", "area de dificil acesso"].includes(data.ambiente)) {
    warnings.push("Ambiente remoto/dificil acesso: bloco logistico avancado exigido.");
    visibleBlocks.add("bloco17");
  }

  if (isSim(data.restricao_trabalho_altura)) warnings.push("Instalacao com complexidade adicional por trabalho em altura.");
  if (isSim(data.link_contingencia_critica)) warnings.push("Operacao critica: energia, monitoramento e SLA tornam-se obrigatorios.");
  if (data.link_principal_ou_complementar.toLowerCase().includes("principal")) warnings.push("Link principal: aumentar exigencias de rede, continuidade e analise tecnica.");

  if (isSim(get(data, "VoIP"))) {
    requireField(id("Ha necessidade de QoS"), "VoIP exige QoS obrigatorio.");
    if (get(data, "Ha necessidade de QoS") !== "sim") {
      errors.push("VoIP exige QoS marcado como sim.");
    }
  }
  if (isSim(get(data, "Aplicacoes sensiveis a latencia"))) {
    warnings.push("Aplicacoes sensiveis a latencia exigem observacao tecnica obrigatoria.");
    requireField("descricao_adicional_aplicacoes", "Aplicacoes sensiveis a latencia exigem observacao tecnica preenchida.");
  }
  if (isSim(get(data, "Sistemas criticos em tempo real"))) warnings.push("Sistemas criticos em tempo real exigem envolvimento de Pre-vendas.");

  if (toNumber(data.qtd_usuarios_simultaneos) > 150) warnings.push("Usuarios simultaneos acima do limite parametrizado: elevar categoria de roteador.");
  if (toNumber(data.qtd_dispositivos_simultaneos) > toNumber(data.qtd_usuarios_simultaneos) * 2) warnings.push("Dispositivos simultaneos muito acima de usuarios: revisar Wi-Fi/rede.");
  if (isSim(data.expectativa_aumento_usuarios)) warnings.push("Crescimento futuro identificado: gerar premissa de escalabilidade.");

  if (isSim(data.deseja_solucao_hibrida)) warnings.push("Solucao hibrida: abrir perguntas de integracao de links.");
  if (isSim(data.failover_atual) || isSim(data.balanceamento_atual) || isSim(data.sdwan_atual)) warnings.push("Aprofundamento de arquitetura exigido por failover/balanceamento/SD-WAN existente.");
  if (isSim(data.deseja_solucao_hibrida) || isSim(data.failover_atual) || isSim(data.balanceamento_atual) || isSim(data.sdwan_atual)) {
    visibleBlocks.add("bloco12");
  }
  if (isSim(data.deseja_solucao_hibrida)) {
    [
      "Ha necessidade de failover automatico",
      "Ha necessidade de failover manual",
      "Ha necessidade de balanceamento",
      "Ha necessidade de SD-WAN",
      "Ha politica de roteamento especifica",
      "Ha necessidade de prioridade de aplicacoes por link",
      "Ha exigencia de comutacao transparente",
      "Ha link primario ja definido",
      "Ha link secundario ja definido",
      "Ha equipamento atual para isso",
      "Ha exigencia de fabricante especifico",
      "Ha necessidade de testes de failover",
      "Ha necessidade de documentacao da topologia",
    ].forEach((label) =>
      requireField(id(label), "Solucao hibrida exige detalhamento completo de integracao de links."),
    );
  }

  if (get(data, "Ha rede local estruturada") === "nao") warnings.push("Sem rede local estruturada: incluir itens minimos para distribuicao interna.");
  if (isSim(get(data, "Ha padrao corporativo obrigatorio de fabricante"))) warnings.push("Padrao corporativo obrigatorio: composicao manual restrita e Pre-vendas obrigatorio.");

  if (isSim(data.escopo_inclui_wifi)) {
    warnings.push("Escopo com Wi-Fi: AP e levantamento de cobertura entram em analise.");
  }
  if (data.tipo_cobertura_desejada === "alta densidade" || isSim(get(data, "Ha paredes/obstrucoes criticas"))) warnings.push("Wi-Fi alta densidade/area complexa: Pre-vendas obrigatorio.");

  if (isSim(get(data, "Ha exigencia de whitelist por IP"))) warnings.push("Whitelist por IP: validar necessidade de IP publico/fixo.");
  if (data.compliance_especifico && data.compliance_especifico !== "nenhum") warnings.push("Compliance especifico: parecer tecnico de conformidade obrigatorio.");

  if (isSim(data.cliente_usa_vpn)) {
    /** IDs alinhados a `formSchema` (toFieldId(label) nem sempre coincide com o id persistido). */
    const obrigatoriosVpn = [
      "tipo_vpn",
      "vpn_critica_operacao",
      "vpn_eventual_ou_continua",
      "sistemas_dependem_vpn",
      ...[
        "Ha necessidade de tunel permanente",
        "Ha necessidade de multiplos tuneis",
        "Ha necessidade de redundancia de VPN",
        "Ha dependencia de IP publico",
        "Ha dependencia de IP fixo",
        "Ha dependencia de whitelist",
        "Ha restricao de NAT/CGNAT",
      ].map(id),
      "portas_protocolos_vpn",
      ...[
        "Ha exigencia de equipamento especifico para VPN",
        "Ha historico de problema atual com VPN",
        "Ha equipe do cliente que validara a VPN",
        "Ha necessidade de teste de homologacao",
      ].map(id),
    ];
    obrigatoriosVpn.forEach((fieldId) =>
      requireField(fieldId, "Cliente usa VPN: todos os campos do bloco VPN tornam-se obrigatorios."),
    );
  }
  if (isSim(data.vpn_critica_operacao)) warnings.push("VPN critica: Pre-vendas obrigatorio.");
  if (isSim(get(data, "Ha dependencia de IP publico")) || isSim(get(data, "Ha dependencia de IP fixo"))) warnings.push("Dependencia de IP publico/fixo: sinalizacao tecnica e comercial obrigatoria.");
  if (isSim(get(data, "Ha restricao de NAT/CGNAT"))) errors.push("Restricao NAT/CGNAT: bloqueio de proposta sem parecer tecnico.");

  if (isSim(get(data, "Ha necessidade de failover automatico")) || isSim(get(data, "Ha necessidade de failover manual")) || isSim(get(data, "Ha necessidade de balanceamento")) || isSim(get(data, "Ha necessidade de SD-WAN"))) {
    warnings.push("Failover/balanceamento/SD-WAN: Pre-vendas obrigatorio.");
    visibleBlocks.add("bloco12");
  }
  if ((isSim(get(data, "Ha necessidade de failover automatico")) || isSim(get(data, "Ha necessidade de balanceamento")) || isSim(get(data, "Ha necessidade de SD-WAN"))) && get(data, "Ha equipamento atual para isso") === "nao") {
    warnings.push("Nao ha equipamento compativel: adicionar roteador/firewall compativel.");
  }

  if (get(data, "Ha linha de visada livre") === "nao") {
    warnings.push("Sem visada livre confirmada: visita tecnica recomendada/obrigatoria.");
  }
  if (toNumber(data.distancia_antena_rack) > 60) warnings.push("Distancia antena-rack elevada: adicionar custo de cabeamento/instalacao.");
  if (isSim(get(data, "Ha exposicao extrema a vento")) || isSim(get(data, "Ha exposicao a salinidade")) || isSim(get(data, "Ha exposicao intensa a poeira"))) warnings.push("Ambiente agressivo: marcar protecao e complexidade adicional.");

  if (isSim(data.link_contingencia_critica)) {
    [
      "tensao_disponivel",
      "ha_nobreak",
      "o_cliente_deseja_monitoramento",
      "horario_suporte_desejado",
    ].forEach((fieldId) =>
      requireField(fieldId, "Operacao critica exige campos obrigatorios de energia/monitoramento/SLA."),
    );
  }
  if (isSim(data.link_contingencia_critica) && get(data, "Ha nobreak") === "nao") warnings.push("Operacao critica sem nobreak: recomendacao obrigatoria e ressalva na proposta.");

  if (isSim(get(data, "O cliente deseja dashboard"))) warnings.push("Dashboard solicitado: adicionar servico correspondente.");
  if (isSim(get(data, "Ha necessidade de retencao historica minima"))) warnings.push("Retencao historica especial: revisar componente recorrente.");

  if (data.horario_suporte_desejado === "24x7") warnings.push("SLA alto: exigir aprovacao comercial/tecnica por alcada.");
  const slaAlto = data.horario_suporte_desejado === "24x7";
  if (slaAlto) warnings.push("SLA alto identificado: aprovacao comercial/tecnica por alcada obrigatoria.");
  if (isSim(data.link_contingencia_critica)) warnings.push("Operacao critica: SLA minimo sugerido automaticamente.");

  if (isSim(data.local_remoto)) warnings.push("Local remoto: abrir todos os custos logisticos.");
  if (isSim(data.local_remoto)) {
    visibleBlocks.add("bloco17");
    [
      ...[
        "Ha acesso por estrada precaria",
        "Ha necessidade de veiculo especial",
        "Ha necessidade de hospedagem",
        "Ha necessidade de transporte aereo/fluvial",
        "Ha restricao de entrada de materiais",
        "Ha necessidade de agendamento com antecedencia",
        "Ha necessidade de documentacao de equipe",
        "Ha necessidade de EPI especifico",
        "Ha necessidade de equipe adicional",
        "Ha necessidade de mais de uma visita",
        "Ha janela curta para execucao",
        "Ha necessidade de mobilizacao especial",
      ].map(id),
      "qtd_estimadas_diarias",
      "prazo_logistico_estimado",
    ].forEach((fieldId) =>
      requireField(fieldId, "Local remoto exige detalhamento completo dos custos logisticos."),
    );
  }
  if (isSim(get(data, "Ha necessidade de mais de uma visita"))) warnings.push("Mais de uma visita: refletir em servicos e preco.");

  if ((data.modelo_oferta === "locacao" || data.modelo_oferta === "servico gerenciado") && get(data, "Ha mensalidade recorrente") !== "sim") {
    errors.push("Locacao/servico gerenciado exige recorrencia e ativos gerenciados obrigatorios.");
  }
  if (data.modelo_oferta === "locacao" || data.modelo_oferta === "servico gerenciado") {
    requireField(id("Ha mensalidade recorrente"), "Locacao/servico gerenciado exige recorrencia obrigatoria.");
    if (get(data, "Ha mensalidade recorrente") !== "sim") {
      errors.push("Locacao/servico gerenciado exige 'Ha mensalidade recorrente' = sim.");
    }
    requireField("monitorar_link_ou_equip", "Locacao/servico gerenciado exige definicao de ativos gerenciados.");
  }
  const budgetBaixo = /baixo|limitado|restrito|ate/i.test(data.faixa_budget ?? "");
  const composicaoMinimaAlta =
    isSim(data.link_contingencia_critica) ||
    isSim(data.escopo_inclui_wifi) ||
    isSim(data.local_remoto) ||
    toNumber(data.quantidade_sites_escopo) > 1;
  if (isSim(get(data, "Ha budget estimado")) && budgetBaixo && composicaoMinimaAlta) {
    warnings.push("Budget possivelmente incompativel com composicao minima: alerta obrigatorio ao Comercial.");
  }

  if (isSim(get(data, "Ha excecoes por site"))) {
    warnings.push("Excecoes por site: gerar estrutura de itens e riscos por site.");
    requireField("obs_multi_site", "Excecoes por site exigem detalhamento de itens e riscos por site em observacoes do multi-site.");
  }

  if (
    data.visita_tecnica_necessaria === "nao" &&
    (get(data, "Ha linha de visada livre") !== "sim" || data.ambiente === "area de dificil acesso" || data.local_remoto === "sim")
  ) {
    warnings.push("Cenario complexo: visita tecnica deve ser recomendada ou obrigatoria.");
  }
  if (
    data.visita_tecnica_obrigatoria === "nao" &&
    (
      !data.local_previsto_antena ||
      get(data, "Ha obstrucoes aparentes") !== "nao" ||
      data.ambiente === "area de dificil acesso" ||
      /alto|critico/i.test(data.nivel_risco_tecnico ?? "")
    )
  ) {
    warnings.push("Instalacao indefinida/obstrucao/complexidade/alto risco: visita tecnica recomendada ou obrigatoria.");
  }

  if (data.existe_ti_interna === "nao") {
    warnings.push("Sem TI interna: reforcar apoio contextual para termos tecnicos e maior dependencia do Comercial/Pre-vendas.");
  }
  if (data.existe_terceiro_ti === "sim") requireField("contato_tecnico_externo", "Existe terceiro de TI: contato tecnico externo deve ser informado.");

  const diasParaImplantacao = data.data_desejada_implantacao
    ? Math.ceil((new Date(data.data_desejada_implantacao).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 999;
  const altaComplexidade = data.complexidade_tecnica === "alta" || data.complexidade_tecnica === "critica" || toNumber(data.quantidade_sites_escopo) > 1;
  if (diasParaImplantacao <= 15 && altaComplexidade) {
    warnings.push("Prazo desejado curto frente a complexidade: sinalizacao de risco logistico obrigatoria.");
  }

  return { errors, warnings, visibleBlocks, requiredFields };
}
