import { db } from "@/lib/db";
import { toFieldId } from "@/lib/formSchema";
import { logger } from "@/lib/logger";
import {
  normalizeFieldType,
  parseOptionsJson,
  parseValidationJson,
  type TenantSchemaBlock,
  type TenantSchemaResponse,
} from "@/lib/formSchemaAdapter";

type DbFormQuestionRow = {
  id: string;
  fieldId: string;
  label: string;
  type: string;
  order: number;
  placeholder: string | null;
  helpText: string | null;
  requiredDefault: boolean;
  optionsJson: string | null;
  validationJson: string | null;
};

type DbFormBlockRow = {
  id: string;
  blockKey: string;
  title: string;
  description: string | null;
  order: number;
  questions: DbFormQuestionRow[];
};

export async function loadTenantFormSchemaByCompanyId(
  companyId: string,
  ownerId: string,
): Promise<TenantSchemaResponse | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true, active: true },
  });
  if (!company || !company.active) return null;

  const blocksFromDb = (await db.formBlock.findMany({
    where: { companyId, ownerId, active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      questions: {
        where: { active: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          fieldId: true,
          label: true,
          type: true,
          order: true,
          placeholder: true,
          helpText: true,
          requiredDefault: true,
          optionsJson: true,
          validationJson: true,
        },
      },
    },
  })) as DbFormBlockRow[];

  const dynamicBlocks: TenantSchemaBlock[] = blocksFromDb.map((block) => ({
    id: block.id,
    key: block.blockKey,
    title: block.title,
    description: block.description,
    order: block.order,
    questions: block.questions.map((question) => {
      const normalizedFieldId = question.fieldId?.trim() || toFieldId(question.label);
      const expectedFieldId = toFieldId(question.label);
      if (normalizedFieldId !== expectedFieldId) {
        logger.warn(
          {
            companyId: company.id,
            blockKey: block.blockKey,
            fieldId: normalizedFieldId,
            expectedFieldId,
          },
          "FormQuestion fieldId fora do padrão toFieldId(label).",
        );
      }
      return {
        id: question.id,
        fieldId: normalizedFieldId,
        label: question.label,
        type: normalizeFieldType(question.type),
        order: question.order,
        placeholder: question.placeholder,
        helpText: question.helpText,
        required: question.requiredDefault,
        options: parseOptionsJson(question.optionsJson),
        validation: parseValidationJson(question.validationJson),
      };
    }),
  }));

  // Isolamento estrito por empresa + dono: sem fallback legado. A "Nova
  // proposta" mostra apenas os blocos dinamicos do proprio usuario.
  return {
    company: { id: company.id, name: company.name, slug: company.slug },
    blocks: dynamicBlocks,
  };
}
