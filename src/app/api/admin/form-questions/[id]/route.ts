import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseOptionsJson, parseValidationJson } from "@/lib/formSchemaAdapter";
import { patchFormQuestionBodySchema } from "@/lib/validators/adminFormBuilder";

const optionTypeSet = new Set(["select", "radio", "checkbox"]);

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isTenantAllowed({
  userRole,
  userCompanyId,
  resourceCompanyId,
}: {
  userRole: string;
  userCompanyId: string | null;
  resourceCompanyId: string;
}) {
  if (userRole === "SUPER_ADMIN") return true;
  return Boolean(userCompanyId) && userCompanyId === resourceCompanyId;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess(request, ["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const existingQuestion = await db.formQuestion.findUnique({
    where: { id },
    select: {
      id: true,
      blockId: true,
      fieldId: true,
      label: true,
      type: true,
      optionsJson: true,
      block: { select: { id: true, companyId: true } },
    },
  });
  if (!existingQuestion) {
    return NextResponse.json({ error: "Pergunta nao encontrada." }, { status: 404 });
  }

  if (
    !isTenantAllowed({
      userRole: auth.user.role,
      userCompanyId: auth.user.companyId,
      resourceCompanyId: existingQuestion.block.companyId,
    })
  ) {
    return NextResponse.json(
      { error: "Sem permissao para editar pergunta de outra empresa." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = patchFormQuestionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const currentOptions = parseOptionsJson(existingQuestion.optionsJson);
  const nextType = parsed.data.type ?? existingQuestion.type;
  const nextOptions = parsed.data.options ?? currentOptions;
  if (optionTypeSet.has(nextType) && nextOptions.length === 0) {
    return NextResponse.json(
      { error: "Perguntas do tipo select/radio/checkbox exigem opcoes." },
      { status: 400 },
    );
  }

  const update: {
    label?: string;
    type?: string;
    placeholder?: string | null;
    helpText?: string | null;
    requiredDefault?: boolean;
    optionsJson?: string | null;
    validationJson?: string | null;
    order?: number;
    active?: boolean;
  } = {};

  if (parsed.data.label !== undefined) update.label = parsed.data.label;
  if (parsed.data.type !== undefined) update.type = parsed.data.type;
  if (parsed.data.placeholder !== undefined) {
    update.placeholder = normalizeNullableText(parsed.data.placeholder) ?? null;
  }
  if (parsed.data.helpText !== undefined) {
    update.helpText = normalizeNullableText(parsed.data.helpText) ?? null;
  }
  if (parsed.data.requiredDefault !== undefined) {
    update.requiredDefault = parsed.data.requiredDefault;
  }
  if (parsed.data.options !== undefined) {
    update.optionsJson = parsed.data.options.length > 0 ? JSON.stringify(parsed.data.options) : null;
  }
  if (parsed.data.validation !== undefined) {
    update.validationJson = JSON.stringify(parsed.data.validation);
  }
  if (parsed.data.order !== undefined) update.order = parsed.data.order;
  if (parsed.data.active !== undefined) update.active = parsed.data.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada a atualizar." }, { status: 400 });
  }

  try {
    const question = await db.formQuestion.update({
      where: { id: existingQuestion.id },
      data: update,
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
        action: "FORM_QUESTION_UPDATED",
        resourceType: "FormQuestion",
        resourceId: question.id,
        detailsJson: JSON.stringify({
          fields: Object.keys(update),
          fieldId: question.fieldId,
          label: question.label,
          type: question.type,
          order: question.order,
          active: question.active,
          companyId: existingQuestion.block.companyId,
          actorRole: auth.user.role,
        }),
        userId: auth.user.id,
      },
    });

    return NextResponse.json({
      question: {
        ...question,
        options: parseOptionsJson(question.optionsJson),
        validation: parseValidationJson(question.validationJson),
      },
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        questionId: existingQuestion.id,
        blockId: existingQuestion.blockId,
        companyId: existingQuestion.block.companyId,
      },
      "Falha ao atualizar pergunta de formulario.",
    );
    return NextResponse.json(
      { error: "Erro interno ao atualizar pergunta de formulario." },
      { status: 500 },
    );
  }
}
