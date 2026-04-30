export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "email"
  | "tel";

export type Option = { label: string; value: string };

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  options?: Option[];
  required?: boolean;
};

export type Block = {
  id: string;
  title: string;
  fields: Field[];
};

export const toFieldId = (label: string) =>
  label.toLowerCase().replaceAll(/[^\w]+/g, "_");

const simNao: Option[] = [
  { label: "Sim", value: "sim" },
  { label: "Nao", value: "nao" },
];

export const blocos: Block[] = [
  {
    id: "bloco1",
    title: "Bloco 1 — Contexto da demanda",
    fields: [
      { id: "nome_interno_solicitacao", label: "Nome interno da solicitacao", type: "text", required: true },
      { id: "tecnologia_proposta", label: "Tecnologia da proposta", type: "text", required: true },
      { id: "tipo_solucao_desejada", label: "Tipo de solucao desejada", type: "select", options: [
        { label: "internet principal", value: "internet principal" },
        { label: "backup", value: "backup" },
        { label: "contingencia", value: "contingencia" },
        { label: "temporario", value: "temporario" },
        { label: "mobilidade", value: "mobilidade" },
        { label: "projeto hibrido", value: "projeto hibrido" },
      ], required: true },
      { id: "urgencia", label: "Urgencia", type: "select", options: [
        { label: "normal", value: "normal" },
        { label: "urgente", value: "urgente" },
        { label: "emergencial", value: "emergencial" },
      ], required: true },
      { id: "data_desejada_implantacao", label: "Data desejada para implantacao", type: "date", required: true },
      { id: "justificativa_urgencia", label: "Justificativa da urgencia", type: "textarea" },
      { id: "origem_demanda", label: "Origem da demanda", type: "text", required: true },
      { id: "comercial_responsavel", label: "Comercial responsavel", type: "text", required: true },
      { id: "segmento_cliente", label: "Segmento do cliente", type: "text", required: true },
      { id: "porte_cliente", label: "Porte do cliente", type: "text", required: true },
      { id: "quantidade_sites_escopo", label: "Quantidade de sites no escopo", type: "number", required: true },
      { id: "demanda_site_unico_multi_site", label: "Demanda site unico ou multi-site", type: "text", required: true },
      { id: "padronizacao_sites", label: "Ha padronizacao entre sites", type: "select", options: simNao, required: true },
      { id: "proposta_unica_ou_por_site", label: "Havera proposta unica ou por site", type: "text", required: true },
      { id: "necessita_visita_antes_proposta", label: "Ha necessidade de visita tecnica antes da proposta", type: "select", options: simNao, required: true },
      { id: "prazo_contratual_imposto_cliente", label: "Ha prazo contratual imposto pelo cliente", type: "select", options: simNao, required: true },
      { id: "necessita_modelo_tese_cliente", label: "Ha necessidade de proposta em modelo/tese especifica do cliente", type: "select", options: simNao, required: true },
      { id: "observacoes_iniciais", label: "Observacoes iniciais", type: "textarea" },
    ],
  },
  {
    id: "bloco2",
    title: "Bloco 2 — Dados do cliente e contatos",
    fields: [
      { id: "nome_prospect_cliente", label: "Nome do prospect/cliente", type: "text", required: true },
      { id: "razao_social", label: "Razao social", type: "text" },
      { id: "nome_fantasia", label: "Nome fantasia", type: "text" },
      { id: "cnpj", label: "CNPJ, se disponivel", type: "text" },
      { id: "segmento_atuacao", label: "Segmento de atuacao", type: "text", required: true },
      { id: "nome_contato_comercial", label: "Nome do contato comercial", type: "text", required: true },
      { id: "cargo_contato_comercial", label: "Cargo do contato comercial", type: "text" },
      { id: "telefone_contato_comercial", label: "Telefone do contato comercial", type: "tel", required: true },
      { id: "email_contato_comercial", label: "E-mail do contato comercial", type: "email", required: true },
      { id: "nome_contato_tecnico", label: "Nome do contato tecnico", type: "text", required: true },
      { id: "cargo_contato_tecnico", label: "Cargo do contato tecnico", type: "text" },
      { id: "telefone_contato_tecnico", label: "Telefone do contato tecnico", type: "tel", required: true },
      { id: "email_contato_tecnico", label: "E-mail do contato tecnico", type: "email", required: true },
      { id: "existe_ti_interna", label: "Existe equipe de TI interna", type: "select", options: simNao, required: true },
      { id: "existe_terceiro_ti", label: "Existe terceiro responsavel por TI", type: "select", options: simNao, required: true },
      { id: "nome_parceiro_integrador", label: "Nome do parceiro/integrador local, se houver", type: "text" },
      { id: "melhor_horario_contato_tecnico", label: "Melhor horario para contato tecnico", type: "text" },
      { id: "obs_cliente", label: "Observacoes sobre o cliente", type: "textarea" },
      { id: "contato_tecnico_externo", label: "Contato tecnico externo (quando houver terceiro)", type: "text" },
    ],
  },
  {
    id: "bloco3",
    title: "Bloco 3 — Localizacao e caracteristicas do site",
    fields: [
      { id: "nome_site", label: "Nome do site", type: "text", required: true },
      { id: "endereco_completo", label: "Endereco completo", type: "text", required: true },
      { id: "cep", label: "CEP", type: "text", required: true },
      { id: "cidade", label: "Cidade", type: "text", required: true },
      { id: "estado", label: "Estado", type: "text", required: true },
      { id: "pais", label: "Pais", type: "text", required: true },
      { id: "latitude", label: "Latitude", type: "text" },
      { id: "longitude", label: "Longitude", type: "text" },
      { id: "tipo_local", label: "Tipo de local", type: "select", required: true, options: [
        { label: "escritorio", value: "escritorio" }, { label: "loja", value: "loja" }, { label: "residencia", value: "residencia" },
        { label: "fazenda", value: "fazenda" }, { label: "industria", value: "industria" }, { label: "canteiro", value: "canteiro" },
        { label: "operacao movel", value: "operacao movel" }, { label: "embarcacao", value: "embarcacao" }, { label: "outro", value: "outro" },
      ] },
      { id: "ambiente", label: "Ambiente", type: "select", required: true, options: [
        { label: "urbano", value: "urbano" }, { label: "rural", value: "rural" },
        { label: "remoto", value: "remoto" }, { label: "area de dificil acesso", value: "area de dificil acesso" },
      ] },
      { id: "mais_de_um_ponto_mesmo_site", label: "Ha mais de um ponto de instalacao no mesmo site", type: "select", options: simNao, required: true },
      { id: "descricao_local", label: "Descricao do local", type: "textarea" },
      { id: "restricoes_acesso_local", label: "Restricoes de acesso ao local", type: "textarea" },
      { id: "agendamento_previo", label: "Ha necessidade de agendamento previo", type: "select", options: simNao, required: true },
      { id: "janela_execucao", label: "Janela permitida para execucao", type: "text" },
      { id: "restricao_documentacao_acesso", label: "Ha restricao de documentacao de acesso", type: "select", options: simNao, required: true },
      { id: "restricao_seguranca_patrimonial", label: "Ha restricao de seguranca patrimonial", type: "select", options: simNao, required: true },
      { id: "restricao_trabalho_altura", label: "Ha restricao de trabalho em altura", type: "select", options: simNao, required: true },
      { id: "escolta_obrigatoria", label: "Ha escolta obrigatoria", type: "select", options: simNao, required: true },
      { id: "autorizacao_proprietario", label: "Ha necessidade de autorizacao do proprietario/local", type: "select", options: simNao, required: true },
      { id: "risco_vandalismo", label: "Ha risco de vandalismo", type: "select", options: simNao, required: true },
      { id: "risco_ambiental", label: "Ha risco ambiental relevante", type: "select", options: simNao, required: true },
      { id: "observacoes_local", label: "Observacoes do local", type: "textarea" },
    ],
  },
  {
    id: "bloco4",
    title: "Bloco 4 — Objetivo da solucao",
    fields: [
      { id: "objetivo_principal_link", label: "Qual o objetivo principal do link", type: "textarea", required: true },
      { id: "link_principal_ou_complementar", label: "O link sera principal ou complementar", type: "text", required: true },
      { id: "link_backup", label: "O link sera backup de outro meio", type: "select", options: simNao, required: true },
      { id: "link_contingencia_critica", label: "O link sera contingencia de operacao critica", type: "select", options: simNao, required: true },
      { id: "link_temporario", label: "O link sera usado em operacao temporaria", type: "select", options: simNao, required: true },
      { id: "link_substituira_atual", label: "O link substituira solucao atual", type: "select", options: simNao, required: true },
      { id: "link_ampliara_rede", label: "O link ampliara rede atual", type: "select", options: simNao, required: true },
      { id: "quer_reduzir_indisponibilidade", label: "O cliente quer reduzir indisponibilidade", type: "select", options: simNao, required: true },
      { id: "quer_aumentar_performance", label: "O cliente quer aumentar performance", type: "select", options: simNao, required: true },
      { id: "quer_reduzir_custo", label: "O cliente quer reduzir custo atual", type: "select", options: simNao, required: true },
      { id: "conectividade_sem_alternativa", label: "O cliente quer levar conectividade a local sem alternativa", type: "select", options: simNao, required: true },
      { id: "quer_mobilidade", label: "O cliente quer mobilidade", type: "select", options: simNao, required: true },
      { id: "ja_usa_satelite", label: "O cliente ja usa satelite atualmente", type: "select", options: simNao, required: true },
      { id: "problemas_atuais_motivam", label: "Quais problemas atuais motivam a proposta", type: "textarea", required: true },
      { id: "impacto_dor", label: "Qual impacto atual da dor", type: "select", options: [
        { label: "operacional", value: "operacional" }, { label: "financeiro", value: "financeiro" },
        { label: "produtividade", value: "produtividade" }, { label: "seguranca", value: "seguranca" },
      ], required: true },
      { id: "data_critica_funcionando", label: "Ha data critica para estar funcionando", type: "select", options: simNao, required: true },
      { id: "contrato_penalidade_atraso_cliente", label: "Ha contrato/penalidade por atraso do lado do cliente", type: "select", options: simNao, required: true },
      { id: "obs_negocio", label: "Observacoes de negocio", type: "textarea" },
    ],
  },
  {
    id: "bloco5",
    title: "Bloco 5 — Aplicacoes e perfil de trafego",
    fields: [
      ...[
        "Navegacao web","E-mail","ERP","Sistemas em nuvem","CFTV","VoIP","Videoconferencia","Acesso remoto","VPN corporativa","SCADA/automacao",
        "Telemetria","Upload de arquivos pesados","Download de arquivos pesados","Streaming","Sistemas criticos em tempo real","Aplicacoes sensiveis a latencia",
        "Aplicacoes sensiveis a perda","Aplicacoes sensiveis a variacao de jitter","Ha necessidade de priorizacao de trafego","Ha necessidade de QoS",
        "Ha trafego segregado por area","Ha horarios de pico definidos","Ha sazonalidade operacional","Ha picos esporadicos de operacao",
        "Ha exigencia de consumo minimo maximo conhecido","Ha limites/restricoes de trafego esperadas pelo cliente"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "qual_horario_pico", label: "Qual o horario de pico", type: "text" },
      { id: "descricao_adicional_aplicacoes", label: "Descricao adicional das aplicacoes", type: "textarea" },
    ],
  },
  {
    id: "bloco6",
    title: "Bloco 6 — Usuarios, dispositivos e crescimento",
    fields: [
      { id: "qtd_total_usuarios", label: "Quantidade total de usuarios", type: "number", required: true },
      { id: "qtd_usuarios_simultaneos", label: "Quantidade de usuarios simultaneos", type: "number", required: true },
      { id: "qtd_dispositivos_simultaneos", label: "Quantidade de dispositivos simultaneos", type: "number", required: true },
      { id: "uso_visitantes", label: "Ha uso por visitantes", type: "select", options: simNao, required: true },
      { id: "uso_terceiros", label: "Ha uso por terceiros", type: "select", options: simNao, required: true },
      { id: "turnos_mesma_infra", label: "Ha turnos diferentes utilizando a mesma infraestrutura", type: "select", options: simNao, required: true },
      { id: "perfil_medio_usuario", label: "Perfil medio do usuario", type: "select", options: [
        { label: "leve", value: "leve" }, { label: "moderado", value: "moderado" }, { label: "intenso", value: "intenso" },
      ], required: true },
      { id: "qtd_estacoes_fixas", label: "Quantidade de estacoes fixas", type: "number", required: true },
      { id: "qtd_dispositivos_moveis", label: "Quantidade de dispositivos moveis", type: "number", required: true },
      { id: "iot_dependentes_link", label: "Ha equipamentos IoT dependentes do link", type: "select", options: simNao, required: true },
      { id: "cameras_ip_dependentes_link", label: "Ha cameras IP dependentes do link", type: "select", options: simNao, required: true },
      { id: "telefones_ip_dependentes_link", label: "Ha telefones IP dependentes do link", type: "select", options: simNao, required: true },
      { id: "expectativa_aumento_usuarios", label: "Ha expectativa de aumento de usuarios", type: "select", options: simNao, required: true },
      { id: "qtd_futura_estimada", label: "Quantidade futura estimada", type: "number" },
      { id: "prazo_previsto_crescimento", label: "Prazo previsto para crescimento", type: "text" },
      { id: "novos_sites_ou_expansao", label: "Existe previsao de novos sites ou expansao", type: "select", options: simNao, required: true },
      { id: "obs_capacidade", label: "Observacoes de capacidade", type: "textarea" },
    ],
  },
  {
    id: "bloco7",
    title: "Bloco 7 — Situacao atual de conectividade",
    fields: [
      { id: "existe_internet_atualmente", label: "Existe internet atualmente", type: "select", options: simNao, required: true },
      { id: "tecnologia_atual", label: "Qual a tecnologia atual", type: "select", options: [
        { label: "fibra", value: "fibra" }, { label: "radio", value: "radio" }, { label: "4G/5G", value: "4G/5G" }, { label: "VSAT", value: "VSAT" }, { label: "outro", value: "outro" },
      ] },
      { id: "provedor_atual", label: "Nome do provedor atual", type: "text" },
      { id: "velocidade_atual_download", label: "Velocidade atual download", type: "text" },
      { id: "velocidade_atual_upload", label: "Velocidade atual upload", type: "text" },
      { id: "conexao_atual_atende", label: "A conexao atual atende", type: "select", options: simNao, required: true },
      { id: "problemas_atuais_ocorrem", label: "Quais problemas atuais ocorrem", type: "select", options: [
        { label: "indisponibilidade", value: "indisponibilidade" }, { label: "lentidao", value: "lentidao" },
        { label: "latencia", value: "latencia" }, { label: "variacao", value: "variacao" }, { label: "cobertura", value: "cobertura" }, { label: "custo", value: "custo" },
      ] },
      { id: "frequencia_problema", label: "Frequencia do problema", type: "text" },
      { id: "link_secundario_existente", label: "Ha link secundario ja existente", type: "select", options: simNao, required: true },
      { id: "failover_atual", label: "Ha failover atual", type: "select", options: simNao, required: true },
      { id: "balanceamento_atual", label: "Ha balanceamento atual", type: "select", options: simNao, required: true },
      { id: "sdwan_atual", label: "Ha SD-WAN atual", type: "select", options: simNao, required: true },
      { id: "deseja_manter_link_atual", label: "O cliente deseja manter o link atual", type: "select", options: simNao, required: true },
      { id: "deseja_substituir_link_atual", label: "O cliente deseja substituir o link atual", type: "select", options: simNao, required: true },
      { id: "deseja_solucao_hibrida", label: "O cliente deseja compor solucao hibrida", type: "select", options: simNao, required: true },
      { id: "obs_conectividade_atual", label: "Observacoes da conectividade atual", type: "textarea" },
    ],
  },
  {
    id: "bloco8",
    title: "Bloco 8 — Rede local, equipamentos e topologia",
    fields: [
      ...[
        "Ha rede local estruturada","Ha cabeamento existente","Ha rack disponivel","Ha espaco fisico para equipamentos","Ha roteador existente",
        "Ha firewall existente","Ha switch existente","Switch gerenciavel","Ha access points existentes","Ha controladora Wi-Fi","Ha rede guest","Ha VLANs",
        "Ha necessidade de novas VLANs","Ha necessidade de segmentacao por areas","Ha necessidade de rede corporativa e rede visitante separadas",
        "Ha necessidade de fornecimento de roteador","Ha necessidade de fornecimento de firewall","Ha necessidade de fornecimento de switch",
        "Ha necessidade de fornecimento de AP","Ha necessidade de cabeamento adicional","Ha necessidade de extensao de rede","Ha necessidade de PoE",
        "Ha exigencia de equipamento homologado pelo cliente","Ha padrao corporativo obrigatorio de fabricante"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "estado_cabeamento", label: "Estado do cabeamento", type: "text" },
      { id: "fabricante_roteador", label: "Fabricante do roteador", type: "text" },
      { id: "modelo_roteador", label: "Modelo do roteador", type: "text" },
      { id: "fabricante_firewall", label: "Fabricante do firewall", type: "text" },
      { id: "modelo_firewall", label: "Modelo do firewall", type: "text" },
      { id: "quantidade_switches", label: "Quantidade de switches", type: "number" },
      { id: "quantidade_access_points", label: "Quantidade de access points", type: "number" },
      { id: "quantidade_estimada_pontos_rede", label: "Quantidade estimada de pontos de rede", type: "number" },
      { id: "topologia_resumida_ambiente", label: "Topologia resumida do ambiente", type: "textarea" },
      { id: "obs_rede_local", label: "Observacoes de rede local", type: "textarea" },
    ],
  },
  {
    id: "bloco9",
    title: "Bloco 9 — Wi-Fi",
    fields: [
      { id: "escopo_inclui_wifi", label: "O escopo inclui Wi-Fi", type: "select", options: simNao, required: true },
      { id: "deseja_cobertura_wifi", label: "O cliente deseja cobertura Wi-Fi", type: "select", options: simNao, required: true },
      { id: "tipo_cobertura_desejada", label: "Tipo de cobertura desejada", type: "select", options: [
        { label: "basica", value: "basica" }, { label: "corporativa", value: "corporativa" }, { label: "alta densidade", value: "alta densidade" },
      ] },
      { id: "area_aproximada_cobrir", label: "Area aproximada a cobrir", type: "text" },
      { id: "numero_ambientes", label: "Numero de ambientes", type: "number" },
      { id: "ambientes_internos", label: "Ambientes internos", type: "text" },
      { id: "ambientes_externos", label: "Ambientes externos", type: "text" },
      { id: "paredes_obstrucoes_criticas", label: "Ha paredes/obstrucoes criticas", type: "select", options: simNao, required: true },
      { id: "necessidade_roaming", label: "Ha necessidade de roaming", type: "select", options: simNao, required: true },
      { id: "necessidade_ssids_separados", label: "Ha necessidade de SSIDs separados", type: "select", options: simNao, required: true },
      { id: "necessidade_portal_guest", label: "Ha necessidade de portal guest", type: "select", options: simNao, required: true },
      { id: "necessidade_autenticacao_corporativa", label: "Ha necessidade de autenticacao corporativa", type: "select", options: simNao, required: true },
      { id: "exigencia_gestao_wifi", label: "Ha exigencia de gestao Wi-Fi", type: "select", options: simNao, required: true },
      { id: "exigencia_mapa_calor_survey", label: "Ha exigencia de mapa de calor ou survey", type: "select", options: simNao, required: true },
      { id: "exigencia_cobertura_externa", label: "Ha exigencia de cobertura externa", type: "select", options: simNao, required: true },
      { id: "obs_wifi", label: "Observacoes de Wi-Fi", type: "textarea" },
    ],
  },
  {
    id: "bloco10",
    title: "Bloco 10 — Seguranca, firewall e politicas",
    fields: [
      ...[
        "Existe politica de seguranca definida","Ha uso de firewall","O firewall atual sera mantido","Ha necessidade de troca de firewall",
        "Ha necessidade de filtragem de conteudo","Ha necessidade de regras de acesso especificas","Ha necessidade de abertura de portas",
        "Ha necessidade de fechamento de portas especificas","Ha necessidade de logs","Ha exigencia de retencao de logs",
        "Ha exigencia de relatorio de seguranca","Ha exigencia de whitelist por IP","Ha exigencia de integracao com politica corporativa do cliente",
        "Ha exigencia de dupla autenticacao em acesso remoto","Ha necessidade de IDS/IPS","Ha necessidade de UTM/NGFW"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "compliance_especifico", label: "Ha compliance especifico", type: "select", options: [
        { label: "nenhum", value: "nenhum" }, { label: "LGPD", value: "LGPD" }, { label: "ISO", value: "ISO" }, { label: "corporativo interno", value: "corporativo interno" }, { label: "outro", value: "outro" },
      ], required: true },
      { id: "obs_seguranca", label: "Observacoes de seguranca", type: "textarea" },
    ],
  },
  {
    id: "bloco11",
    title: "Bloco 11 — VPN e integracao corporativa",
    fields: [
      { id: "cliente_usa_vpn", label: "O cliente usa VPN", type: "select", options: simNao, required: true },
      { id: "tipo_vpn", label: "Tipo de VPN", type: "select", options: [
        { label: "IPsec", value: "IPsec" }, { label: "SSL VPN", value: "SSL VPN" }, { label: "client-to-site", value: "client-to-site" }, { label: "site-to-site", value: "site-to-site" },
        { label: "MPLS/VPN corporativa", value: "MPLS/VPN corporativa" }, { label: "outro", value: "outro" },
      ] },
      { id: "vpn_critica_operacao", label: "A VPN e critica para operacao", type: "select", options: simNao, required: true },
      { id: "vpn_eventual_ou_continua", label: "A VPN e para acesso eventual ou continuo", type: "text" },
      { id: "sistemas_dependem_vpn", label: "Quais sistemas dependem da VPN", type: "textarea" },
      ...[
        "Ha necessidade de tunel permanente","Ha necessidade de multiplos tuneis","Ha necessidade de redundancia de VPN","Ha dependencia de IP publico",
        "Ha dependencia de IP fixo","Ha dependencia de whitelist","Ha restricao de NAT/CGNAT","Ha exigencia de equipamento especifico para VPN",
        "Ha historico de problema atual com VPN","Ha equipe do cliente que validara a VPN","Ha necessidade de teste de homologacao"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "portas_protocolos_vpn", label: "Ha portas/protocolos especificos exigidos", type: "text" },
      { id: "obs_vpn", label: "Observacoes de VPN", type: "textarea" },
    ],
  },
  {
    id: "bloco12",
    title: "Bloco 12 — Integracao de links, failover, balanceamento e SD-WAN",
    fields: [
      ...[
        "Ha necessidade de failover automatico","Ha necessidade de failover manual","Ha necessidade de balanceamento","Ha necessidade de SD-WAN",
        "Ha politica de roteamento especifica","Ha necessidade de prioridade de aplicacoes por link","Ha exigencia de comutacao transparente",
        "Ha link primario ja definido","Ha link secundario ja definido","Ha equipamento atual para isso","Ha exigencia de fabricante especifico",
        "Ha necessidade de testes de failover","Ha necessidade de documentacao da topologia"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "obs_integracao", label: "Observacoes de integracao", type: "textarea" },
    ],
  },
  {
    id: "bloco13",
    title: "Bloco 13 — Infraestrutura fisica da instalacao Starlink",
    fields: [
      { id: "local_previsto_antena", label: "Local previsto da antena", type: "select", options: [
        { label: "telhado", value: "telhado" }, { label: "torre", value: "torre" }, { label: "solo", value: "solo" }, { label: "fachada", value: "fachada" }, { label: "poste", value: "poste" }, { label: "outro", value: "outro" },
      ], required: true },
      ...[
        "A estrutura ja existe","Ha necessidade de suporte adicional","Ha necessidade de mastro","Ha linha de visada livre",
        "Ha obstrucoes aparentes","Ha passagem de cabo disponivel","Ha necessidade de eletroduto/canaleta","Ha necessidade de obra civil leve",
        "Ha necessidade de estrutura metalica adicional","Ha necessidade de fixacao especial","Ha limitacao de posicionamento da antena",
        "Ha exposicao extrema a vento","Ha exposicao a salinidade","Ha exposicao intensa a poeira","Ha risco de vandalismo/furto",
        "Ha necessidade de protecao fisica adicional","Ha necessidade de visita tecnica para confirmar instalacao"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "altura_estimada_instalacao", label: "Altura estimada da instalacao", type: "text" },
      { id: "tipo_obstrucao", label: "Tipo de obstrucao", type: "select", options: [
        { label: "arvores", value: "arvores" }, { label: "predios", value: "predios" }, { label: "estruturas metalicas", value: "estruturas metalicas" }, { label: "relevo", value: "relevo" }, { label: "outro", value: "outro" },
      ] },
      { id: "distancia_antena_rack", label: "Distancia entre antena e rack/ponto interno", type: "text" },
      { id: "distancia_antena_energia", label: "Distancia entre antena e energia", type: "text" },
      { id: "obs_infra_fisica", label: "Observacoes da infraestrutura fisica", type: "textarea" },
    ],
  },
  {
    id: "bloco14",
    title: "Bloco 14 — Energia, protecao e continuidade",
    fields: [
      { id: "tensao_disponivel", label: "Tensao disponivel", type: "text", required: true },
      ...[
        "Ha circuito dedicado","Ha aterramento adequado","Ha DPS","Ha nobreak","Ha gerador","Ha historico de quedas de energia",
        "O servico e sensivel a interrupcao eletrica","Ha necessidade de autonomia minima","Ha necessidade de fornecimento de nobreak",
        "Ha necessidade de adequacao eletrica","Ha necessidade de regua/PDU","Ha necessidade de protecao adicional"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "potencia_autonomia_nobreak", label: "Potencia/autonomia atual do nobreak", type: "text" },
      { id: "frequencia_quedas", label: "Frequencia das quedas", type: "text" },
      { id: "autonomia_esperada", label: "Quantos minutos/horas de autonomia sao esperados", type: "text" },
      { id: "obs_energia", label: "Observacoes de energia", type: "textarea" },
    ],
  },
  {
    id: "bloco15",
    title: "Bloco 15 — Monitoramento, dashboard e gestao",
    fields: [
      ...[
        "O cliente deseja monitoramento","O cliente deseja dashboard","O cliente deseja visualizar disponibilidade","O cliente deseja visualizar uso de banda",
        "O cliente deseja visualizar eventos/incidentes","O cliente deseja visualizar historico","O cliente deseja receber alertas",
        "O cliente deseja acesso proprio ao dashboard","O cliente deseja dashboard apenas interno do fornecedor","O cliente deseja relatorios periodicos",
        "Ha necessidade de retencao historica minima","Ha integracao com NOC do cliente"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "tipo_dashboard", label: "Tipo de dashboard", type: "select", options: [{ label: "executivo", value: "executivo" }, { label: "tecnico", value: "tecnico" }, { label: "ambos", value: "ambos" }] },
      { id: "tipo_alerta", label: "Tipo de alerta", type: "select", options: [{ label: "e-mail", value: "e-mail" }, { label: "painel", value: "painel" }, { label: "ambos", value: "ambos" }] },
      { id: "frequencia_relatorios", label: "Frequencia de relatorios", type: "text" },
      { id: "monitorar_link_ou_equip", label: "O cliente deseja monitorar apenas link ou tambem equipamentos", type: "text" },
      { id: "obs_monitoramento", label: "Observacoes de monitoramento", type: "textarea" },
    ],
  },
  {
    id: "bloco16",
    title: "Bloco 16 — SLA, suporte e operacao",
    fields: [
      { id: "horario_suporte_desejado", label: "Horario de suporte desejado", type: "select", options: [{ label: "horario comercial", value: "horario comercial" }, { label: "12x5", value: "12x5" }, { label: "24x7", value: "24x7" }], required: true },
      { id: "tempo_resposta_desejado", label: "Tempo de resposta desejado", type: "text", required: true },
      { id: "tempo_solucao_desejado", label: "Tempo de solucao desejado", type: "text", required: true },
      ...[
        "Atendimento remoto necessario","Atendimento em campo necessario","Janela de manutencao restrita","Ha penalidade contratual esperada",
        "Ha criticidade formal da operacao","Ha necessidade de escalation path definido","Ha necessidade de contato tecnico de plantao do cliente",
        "Ha necessidade de suporte proativo","Ha necessidade de acompanhamento de performance"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "obs_sla_suporte", label: "Observacoes de SLA e suporte", type: "textarea" },
    ],
  },
  {
    id: "bloco17",
    title: "Bloco 17 — Logistica, mobilizacao e execucao",
    fields: [
      { id: "local_remoto", label: "Local remoto", type: "select", options: simNao, required: true },
      ...[
        "Ha acesso por estrada precaria","Ha necessidade de veiculo especial","Ha necessidade de hospedagem","Ha necessidade de transporte aereo/fluvial",
        "Ha restricao de entrada de materiais","Ha necessidade de agendamento com antecedencia","Ha necessidade de documentacao de equipe",
        "Ha necessidade de EPI especifico","Ha necessidade de equipe adicional","Ha necessidade de mais de uma visita",
        "Ha janela curta para execucao","Ha necessidade de mobilizacao especial"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "qtd_estimadas_diarias", label: "Quantidade estimada de diarias", type: "number" },
      { id: "prazo_logistico_estimado", label: "Prazo logistico estimado conhecido", type: "text" },
      { id: "obs_logisticas", label: "Observacoes logisticas", type: "textarea" },
    ],
  },
  {
    id: "bloco18",
    title: "Bloco 18 — Modelo comercial e contratacao",
    fields: [
      { id: "modelo_oferta", label: "Modelo da oferta", type: "select", options: [
        { label: "venda", value: "venda" }, { label: "locacao", value: "locacao" }, { label: "servico gerenciado", value: "servico gerenciado" }, { label: "implantacao + recorrencia", value: "implantacao + recorrencia" },
      ], required: true },
      ...[
        "Ha mensalidade recorrente","Ha contrato minimo","Ha fidelidade","Ha reajuste contratual previsto","Ha necessidade de parcelamento de implantacao",
        "Ha budget estimado","Ha concorrencia conhecida","Ha proposta concorrente","Ha exigencia de template comercial do cliente",
        "Ha exigencia juridica/comercial especifica"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "prazo_contratual_pretendido", label: "Prazo contratual pretendido", type: "text" },
      { id: "forma_pagamento_pretendida", label: "Forma de pagamento pretendida", type: "text" },
      { id: "faixa_budget", label: "Faixa de budget", type: "text" },
      { id: "sensibilidade_maior_cliente", label: "Sensibilidade maior do cliente", type: "select", options: [
        { label: "preco", value: "preco" }, { label: "prazo", value: "prazo" }, { label: "SLA", value: "SLA" }, { label: "performance", value: "performance" },
      ] },
      { id: "obs_comerciais", label: "Observacoes comerciais", type: "textarea" },
    ],
  },
  {
    id: "bloco19",
    title: "Bloco 19 — Multi-site",
    fields: [
      { id: "ms_qtd_total_sites", label: "Quantidade total de sites", type: "number", required: true },
      ...[
        "Todos os sites tem o mesmo perfil","Havera proposta unica consolidada","Havera precos individualizados por site","Ha sites criticos e sites padrao",
        "Ha lista detalhada de sites","Cada site exige ficha individual","Ha padrao unico de solucao","Ha excecoes por site","Ha cronograma faseado"
      ].map((label) => ({ id: toFieldId(label), label, type: "select" as const, options: simNao, required: true })),
      { id: "obs_multi_site", label: "Observacoes do multi-site", type: "textarea" },
    ],
  },
  {
    id: "bloco20",
    title: "Bloco 20 — Visita tecnica",
    fields: [
      { id: "visita_tecnica_necessaria", label: "Visita tecnica e necessaria", type: "select", options: simNao, required: true },
      { id: "visita_tecnica_obrigatoria", label: "Visita tecnica e obrigatoria antes da proposta", type: "select", options: simNao, required: true },
      { id: "motivo_visita", label: "Motivo da visita", type: "textarea" },
      { id: "objetivos_visita", label: "Objetivos da visita", type: "textarea" },
      { id: "cliente_aprova_visita_paga", label: "Cliente aprova visita paga", type: "select", options: simNao, required: true },
      { id: "disponibilidade_agenda", label: "Ha disponibilidade para agenda", type: "select", options: simNao, required: true },
      { id: "urgencia_visita", label: "Ha urgencia para visita", type: "select", options: simNao, required: true },
      { id: "obs_visita", label: "Observacoes da visita", type: "textarea" },
    ],
  },
  {
    id: "bloco21",
    title: "Bloco 21 — Campo interno do Pre-vendas",
    fields: [
      { id: "complexidade_tecnica", label: "Complexidade tecnica", type: "select", options: [
        { label: "baixa", value: "baixa" }, { label: "media", value: "media" }, { label: "alta", value: "alta" }, { label: "critica", value: "critica" },
      ], required: true },
      { id: "nivel_risco_tecnico", label: "Nivel de risco tecnico", type: "text", required: true },
      { id: "nivel_risco_logistico", label: "Nivel de risco logistico", type: "text", required: true },
      { id: "nivel_risco_comercial", label: "Nivel de risco comercial", type: "text", required: true },
      { id: "necessidade_visita_tecnica", label: "Necessidade de visita tecnica", type: "text", required: true },
      { id: "premissas_tecnicas_obrigatorias", label: "Premissas tecnicas obrigatorias", type: "textarea", required: true },
      { id: "exclusoes_tecnicas_obrigatorias", label: "Exclusoes tecnicas obrigatorias", type: "textarea", required: true },
      { id: "restricoes_identificadas", label: "Restricoes identificadas", type: "textarea", required: true },
      { id: "solucao_recomendada", label: "Solucao recomendada", type: "textarea", required: true },
      { id: "itens_tecnicos_obrigatorios", label: "Itens tecnicos obrigatorios", type: "textarea", required: true },
      { id: "itens_tecnicos_recomendados", label: "Itens tecnicos recomendados", type: "textarea", required: true },
      { id: "itens_opcionais", label: "Itens opcionais", type: "textarea", required: true },
      { id: "servicos_tecnicos_obrigatorios", label: "Servicos tecnicos obrigatorios", type: "textarea", required: true },
      { id: "servicos_tecnicos_recomendados", label: "Servicos tecnicos recomendados", type: "textarea", required: true },
      { id: "obs_para_comercial", label: "Observacoes para o Comercial", type: "textarea", required: true },
      { id: "aprovacao_tecnica", label: "Aprovacao tecnica", type: "select", options: [
        { label: "aprovada", value: "aprovada" }, { label: "aprovada com ressalva", value: "aprovada com ressalva" },
        { label: "devolvida com pendencia", value: "devolvida com pendencia" }, { label: "reprovada", value: "reprovada" },
      ], required: true },
      { id: "justificativa_decisao", label: "Justificativa da decisao", type: "textarea", required: true },
    ],
  },
];

export const defaultValues = Object.fromEntries(
  blocos.flatMap((b) => b.fields.map((f) => [f.id, ""])),
) as Record<string, string>;
