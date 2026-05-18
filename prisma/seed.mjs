import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import pino from "pino";

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "formsis-seed" },
});

const simNao = [
  { label: "Sim", value: "sim" },
  { label: "Nao", value: "nao" },
];

const toFieldId = (label) => label.toLowerCase().replaceAll(/[^\w]+/g, "_");

const attendSchema = [
  {
    key: "bloco1",
    title: "Bloco 1 — Contexto da demanda (Attend)",
    description: "Questionário inicial da empresa Attend.",
    order: 1,
    questions: [
      {
        label: "Cenario atual de conectividade",
        fieldId: "cenario_atual_conectividade",
        type: "textarea",
        required: true,
        placeholder: "Qual o cenário atual de conectividade da unidade/site?",
      },
      {
        label: "Links ativos e tecnologias",
        fieldId: "links_ativos_tecnologias",
        type: "textarea",
        required: true,
        placeholder: "Quais links e tecnologias existem hoje no ambiente?",
      },
      {
        label: "Finalidade da solucao",
        fieldId: "finalidade_solucao",
        type: "select",
        required: true,
        options: [
          { label: "Principal", value: "principal" },
          { label: "Contingencia", value: "contingencia" },
          { label: "Ampliacao", value: "ampliacao" },
        ],
      },
      {
        label: "Escopo de unidades",
        fieldId: "escopo_unidades",
        type: "number",
        required: true,
        placeholder: "Quantas unidades entram no escopo?",
      },
      {
        label: "Aplicacoes criticas",
        fieldId: "aplicacoes_criticas",
        type: "textarea",
        required: true,
        placeholder: "Quais aplicações são críticas para o cliente?",
      },
      {
        label: "Historico de estabilidade",
        fieldId: "historico_estabilidade",
        type: "select",
        required: true,
        options: [
          { label: "Sim", value: "sim" },
          { label: "Nao", value: "nao" },
          { label: "Parcial", value: "parcial" },
        ],
      },
      {
        label: "Necessidade de redundancia",
        fieldId: "necessidade_redundancia",
        type: "select",
        required: true,
        options: simNao,
      },
      {
        label: "Gestao centralizada",
        fieldId: "gestao_centralizada",
        type: "select",
        required: true,
        options: simNao,
      },
      {
        label: "Perspectiva de crescimento",
        fieldId: "perspectiva_crescimento",
        type: "textarea",
        required: true,
      },
      {
        label: "Limitacoes locais",
        fieldId: "limitacoes_locais",
        type: "textarea",
        required: true,
      },
      {
        label: "Urgencia",
        fieldId: "urgencia",
        type: "select",
        required: true,
        options: [
          { label: "Normal", value: "normal" },
          { label: "Urgente", value: "urgente" },
          { label: "Emergencial", value: "emergencial" },
        ],
      },
      {
        label: "Justificativa de urgencia",
        fieldId: "justificativa_urgencia",
        type: "textarea",
        required: false,
        placeholder: "Obrigatório quando urgência for urgente/emergencial.",
      },
    ],
  },
  {
    key: "bloco21",
    title: "Bloco 21 — Campo interno do Pre-vendas",
    description: "Campos internos exclusivos de PRE_VENDAS/ADMIN.",
    order: 21,
    questions: [
      {
        label: "Complexidade tecnica",
        fieldId: "complexidade_tecnica",
        type: "select",
        required: true,
        options: [
          { label: "baixa", value: "baixa" },
          { label: "media", value: "media" },
          { label: "alta", value: "alta" },
          { label: "critica", value: "critica" },
        ],
      },
      {
        label: "Nivel de risco tecnico",
        fieldId: "nivel_risco_tecnico",
        type: "text",
        required: true,
      },
      {
        label: "Solucao recomendada",
        fieldId: "solucao_recomendada",
        type: "textarea",
        required: true,
      },
      {
        label: "Aprovacao tecnica",
        fieldId: "aprovacao_tecnica",
        type: "select",
        required: true,
        options: [
          { label: "aprovada", value: "aprovada" },
          { label: "aprovada com ressalva", value: "aprovada com ressalva" },
          { label: "devolvida com pendencia", value: "devolvida com pendencia" },
          { label: "reprovada", value: "reprovada" },
        ],
      },
      {
        label: "Justificativa da decisao",
        fieldId: "justificativa_decisao",
        type: "textarea",
        required: true,
      },
    ],
  },
];

const v8Schema = [
  {
    key: "bloco1",
    title: "Bloco 1 — Diagnóstico inicial (V8)",
    description: "Perguntas personalizadas para a operação V8.",
    order: 1,
    questions: [
      {
        label: "Cenario atual (V8)",
        fieldId: "cenario_atual_conectividade",
        type: "textarea",
        required: true,
      },
      {
        label: "Objetivo de conectividade V8",
        fieldId: "objetivo_de_conectividade_v8",
        type: "textarea",
        required: true,
      },
      {
        label: "Escopo de unidades",
        fieldId: "escopo_unidades",
        type: "number",
        required: true,
      },
      {
        label: "Ambiente principal da operacao",
        fieldId: "ambiente",
        type: "select",
        required: true,
        options: [
          { label: "urbano", value: "urbano" },
          { label: "rural", value: "rural" },
          { label: "remoto", value: "remoto" },
          { label: "area de dificil acesso", value: "area de dificil acesso" },
        ],
      },
      {
        label: "Finalidade da solucao",
        fieldId: "finalidade_solucao",
        type: "select",
        required: true,
        options: [
          { label: "Principal", value: "principal" },
          { label: "Contingencia", value: "contingencia" },
          { label: "Expansao", value: "expansao" },
        ],
      },
      {
        label: "Aplicacoes criticas",
        fieldId: "aplicacoes_criticas",
        type: "textarea",
        required: true,
      },
      {
        label: "Criticidade operacional V8",
        fieldId: "criticidade_operacional_v8",
        type: "select",
        required: true,
        options: [
          { label: "baixa", value: "baixa" },
          { label: "media", value: "media" },
          { label: "alta", value: "alta" },
        ],
      },
      {
        label: "Urgencia",
        fieldId: "urgencia",
        type: "select",
        required: true,
        options: [
          { label: "Normal", value: "normal" },
          { label: "Urgente", value: "urgente" },
          { label: "Emergencial", value: "emergencial" },
        ],
      },
      {
        label: "Justificativa de urgencia",
        fieldId: "justificativa_urgencia",
        type: "textarea",
        required: false,
      },
      {
        label: "Observacoes gerais do contexto V8",
        fieldId: "observacoes_gerais_contexto_v8",
        type: "textarea",
        required: false,
      },
    ],
  },
  {
    key: "bloco21",
    title: "Bloco 21 — Campo interno do Pre-vendas",
    description: "Campos internos exclusivos de PRE_VENDAS/ADMIN.",
    order: 21,
    questions: [
      {
        label: "Complexidade tecnica",
        fieldId: "complexidade_tecnica",
        type: "select",
        required: true,
        options: [
          { label: "baixa", value: "baixa" },
          { label: "media", value: "media" },
          { label: "alta", value: "alta" },
          { label: "critica", value: "critica" },
        ],
      },
      {
        label: "Nivel de risco tecnico",
        fieldId: "nivel_risco_tecnico",
        type: "text",
        required: true,
      },
      {
        label: "Solucao recomendada",
        fieldId: "solucao_recomendada",
        type: "textarea",
        required: true,
      },
      {
        label: "Aprovacao tecnica",
        fieldId: "aprovacao_tecnica",
        type: "select",
        required: true,
        options: [
          { label: "aprovada", value: "aprovada" },
          { label: "aprovada com ressalva", value: "aprovada com ressalva" },
          { label: "devolvida com pendencia", value: "devolvida com pendencia" },
          { label: "reprovada", value: "reprovada" },
        ],
      },
      {
        label: "Justificativa da decisao",
        fieldId: "justificativa_decisao",
        type: "textarea",
        required: true,
      },
    ],
  },
];

async function upsertCompany({ name, slug }) {
  return prisma.company.upsert({
    where: { slug },
    update: { name, active: true },
    create: { name, slug, active: true },
  });
}

async function upsertUser(email, name, role, password, companyIds = []) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, active: true },
    create: { email, name, role, passwordHash, active: true },
  });

  for (const companyId of companyIds) {
    await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: {},
      create: { userId: user.id, companyId },
    });
  }

  return user;
}

async function upsertBlockWithQuestions(companyId, ownerId, blockConfig) {
  const block = await prisma.formBlock.upsert({
    where: {
      companyId_ownerId_blockKey: {
        companyId,
        ownerId,
        blockKey: blockConfig.key,
      },
    },
    update: {
      title: blockConfig.title,
      description: blockConfig.description ?? null,
      order: blockConfig.order,
      active: true,
    },
    create: {
      companyId,
      ownerId,
      blockKey: blockConfig.key,
      title: blockConfig.title,
      description: blockConfig.description ?? null,
      order: blockConfig.order,
      active: true,
    },
  });

  await prisma.formQuestion.deleteMany({ where: { blockId: block.id } });

  for (const [questionIndex, question] of blockConfig.questions.entries()) {
    const normalizedLabel = question.label.trim();
    const normalizedFieldId = (question.fieldId?.trim() || toFieldId(normalizedLabel));
    await prisma.formQuestion.create({
      data: {
        blockId: block.id,
        fieldId: normalizedFieldId,
        label: normalizedLabel,
        type: question.type,
        placeholder: question.placeholder ?? null,
        helpText: question.helpText ?? null,
        requiredDefault: Boolean(question.required),
        optionsJson: question.options?.length ? JSON.stringify(question.options) : null,
        validationJson: question.validation ? JSON.stringify(question.validation) : null,
        order: question.order ?? questionIndex + 1,
        active: true,
      },
    });
  }
}

async function seedCompanySchema(companyId, ownerId, schemaBlocks) {
  for (const blockConfig of schemaBlocks) {
    await upsertBlockWithQuestions(companyId, ownerId, blockConfig);
  }
}

async function main() {
  const attend = await upsertCompany({ name: "Attend", slug: "attend" });
  const v8 = await upsertCompany({ name: "V8", slug: "v8" });

  const superAdmin = await upsertUser(
    process.env.FORMSIS_ADMIN_EMAIL ?? "admin@formsis.local",
    "Super Administrador",
    UserRole.SUPER_ADMIN,
    process.env.FORMSIS_ADMIN_PASSWORD ?? "Admin@123",
    [],
  );

  await seedCompanySchema(attend.id, superAdmin.id, attendSchema);
  await seedCompanySchema(v8.id, superAdmin.id, v8Schema);

  logger.info(
    {
      companiesSeeded: [attend.slug, v8.slug],
      attendBlocks: attendSchema.length,
      v8Blocks: v8Schema.length,
    },
    "Seed concluido com schema dinâmico por empresa.",
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    logger.error({ err: error }, "Falha ao executar seed.");
    await prisma.$disconnect();
    process.exit(1);
  });
