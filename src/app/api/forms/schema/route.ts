import { NextRequest, NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/auth";
import { loadTenantFormSchemaByCompanyId } from "@/lib/formSchemaService";
import { PRE_SALES_INTERNAL_BLOCK_ID } from "@/lib/rulesEngine";

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, [
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  if (!auth.user.activeCompanyId) {
    return NextResponse.json(
      { error: "Selecione uma empresa antes de continuar.", redirectTo: "/select-company" },
      { status: 409 },
    );
  }

  const schema = await loadTenantFormSchemaByCompanyId(auth.user.activeCompanyId);
  if (!schema) {
    return NextResponse.json(
      { error: "Empresa sem schema ativo de formulario." },
      { status: 404 },
    );
  }

  const canSeeInternalBlock =
    auth.user.role === "PRE_VENDAS" || auth.user.role === "ADMIN";
  const blocks = [...schema.blocks]
    .filter((block) => canSeeInternalBlock || block.key !== PRE_SALES_INTERNAL_BLOCK_ID)
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      id: block.id,
      key: block.key,
      title: block.title,
      description: block.description,
      order: block.order,
      questions: [...block.questions].sort((a, b) => a.order - b.order).map((question) => ({
        id: question.id,
        fieldId: question.fieldId,
        label: question.label,
        type: question.type,
        required: question.required,
        placeholder: question.placeholder ?? undefined,
        options: question.options ?? [],
        validation: question.validation ?? {},
      })),
    }));

  return NextResponse.json({
    company: schema.company,
    blocks,
  });
}
