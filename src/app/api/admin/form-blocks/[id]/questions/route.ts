import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { toFieldId } from "@/lib/formSchema";
import { parseOptionsJson, parseValidationJson } from "@/lib/formSchemaAdapter";
import { createFormQuestionBodySchema } from "@/lib/validators/adminFormBuilder";

const optionTypeSet = new Set(["select", "radio", "checkbox"]);

type DbFormQuestionRow = {
  id: string;
  blockId: string;
  fieldId: string;
  label: string;
  type: string;
  placeholder: string | null;
  helpText: string | null;
  requiredDefault: boolean;
  optionsJson: string | null;
  validationJson: string | null;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function ensureBlockTenantAccessOrError({
  companyId,
  authUserRole,
  authUserCompanyId,
}: {
  companyId: string;
  authUserRole: string;
  authUserCompanyId: string | null;
}) {
  if (authUserRole === "SUPER_ADMIN") return null;
  if (!authUserCompanyId) {
    return NextResponse.json({ error: "Administrador sem empresa vinculada." }, { status: 403 });
  }
  if (companyId !== authUserCompanyId) {
    return NextResponse.json(
      { error: "Sem permissao para acessar bloco de outra empresa." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const block = await db.formBlock.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      blockKey: true,
      title: true,
      description: true,
      order: true,
      active: true,
      company: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!block) {
    return NextResponse.json({ error: "Bloco nao encontrado." }, { status: 404 });
  }

  const tenantError = ensureBlockTenantAccessOrError({
    companyId: block.companyId,
    authUserRole: auth.user.role,
    authUserCompanyId: auth.user.companyId,
  });
  if (tenantError) return tenantError;

  const questions = (await db.formQuestion.findMany({
    where: { blockId: block.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      blockId: true,
      fieldId: true,
      label: true,
      type: true,
      placeholder: true,
      helpText: true,
      requiredDefault: true,
      optionsJson: true,
      validationJson: true,
      order: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as DbFormQuestionRow[];

  return NextResponse.json({
    block,
    questions: questions.map((question) => ({
      ...question,
      options: parseOptionsJson(question.optionsJson),
      validation: parseValidationJson(question.validationJson),
    })),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const block = await db.formBlock.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      blockKey: true,
      title: true,
      company: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!block) {
    return NextResponse.json({ error: "Bloco nao encontrado." }, { status: 404 });
  }

  const tenantError = ensureBlockTenantAccessOrError({
    companyId: block.companyId,
    authUserRole: auth.user.role,
    authUserCompanyId: auth.user.companyId,
  });
  if (tenantError) return tenantError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = createFormQuestionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const fieldId = toFieldId(parsed.data.label);
  if (!fieldId) {
    return NextResponse.json(
      { error: "Nao foi possivel gerar fieldId a partir do label informado." },
      { status: 400 },
    );
  }

  const isOptionType = optionTypeSet.has(parsed.data.type);
  const options = parsed.data.options ?? [];
  if (isOptionType && options.length === 0) {
    return NextResponse.json(
      { error: "Perguntas do tipo select/radio/checkbox exigem opcoes." },
      { status: 400 },
    );
  }

  const optionsJson = options.length > 0 ? JSON.stringify(options) : null;
  const validationJson = parsed.data.validation
    ? JSON.stringify(parsed.data.validation)
    : null;

  try {
    const question = await db.formQuestion.create({
      data: {
        blockId: block.id,
        fieldId,
        label: parsed.data.label,
        type: parsed.data.type,
        placeholder: normalizeNullableText(parsed.data.placeholder) ?? null,
        helpText: normalizeNullableText(parsed.data.helpText) ?? null,
        requiredDefault: parsed.data.requiredDefault ?? false,
        optionsJson,
        validationJson,
        order: parsed.data.order,
        active: parsed.data.active ?? true,
      },
      select: {
        id: true,
        blockId: true,
        fieldId: true,
        label: true,
        type: true,
        placeholder: true,
        helpText: true,
        requiredDefault: true,
        optionsJson: true,
        validationJson: true,
        order: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        action: "FORM_QUESTION_CREATED",
        resourceType: "FormQuestion",
        resourceId: question.id,
        detailsJson: JSON.stringify({
          blockId: question.blockId,
          fieldId: question.fieldId,
          label: question.label,
          type: question.type,
          order: question.order,
          active: question.active,
          companyId: block.companyId,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json(
      {
        question: {
          ...question,
          options: parseOptionsJson(question.optionsJson),
          validation: parseValidationJson(question.validationJson),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Ja existe pergunta com este fieldId no bloco informado." },
        { status: 409 },
      );
    }

    logger.error(
      { err: error, blockId: block.id, companyId: block.companyId },
      "Falha ao criar pergunta de formulario.",
    );
    return NextResponse.json(
      { error: "Erro interno ao criar pergunta de formulario." },
      { status: 500 },
    );
  }
}
