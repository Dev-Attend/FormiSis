"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AppCard } from "@/components/AppCard";
import { PageHeader } from "@/components/PageHeader";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/uiClasses";

type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "boolean";

type OptionRow = {
  label: string;
  value: string;
};

type BlockSummary = {
  id: string;
  companyId: string;
  blockKey: string;
  title: string;
  description: string | null;
  order: number;
  active: boolean;
  company: { id: string; name: string; slug: string } | null;
};

type QuestionRow = {
  id: string;
  blockId: string;
  fieldId: string;
  label: string;
  type: QuestionType;
  placeholder: string | null;
  helpText: string | null;
  requiredDefault: boolean;
  order: number;
  active: boolean;
  options: OptionRow[];
  validation: Record<string, unknown>;
};

const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Numero" },
  { value: "select", label: "Select" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Booleano" },
];

function parseOptionsInput(raw: string): OptionRow[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const [labelPart, ...valueParts] = line.split("|");
    const label = labelPart?.trim() ?? "";
    const value = valueParts.join("|").trim() || label;
    if (!label || !value) {
      throw new Error("Cada opcao deve conter texto valido.");
    }
    return { label, value };
  });
}

function formatOptionsOutput(options: OptionRow[]) {
  return options.map((option) => `${option.label}|${option.value}`).join("\n");
}

function parseValidationInput(raw: string): Record<string, unknown> | undefined {
  const normalized = raw.trim();
  if (!normalized) return undefined;
  const parsed = JSON.parse(normalized) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Validation deve ser um objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

export default function AdminPerguntasDoBlocoPage() {
  const params = useParams<{ blockId: string }>();
  const router = useRouter();
  const blockId = String(params.blockId ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [meRole, setMeRole] = useState<string | null>(null);
  const [block, setBlock] = useState<BlockSummary | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null);

  const [createLabel, setCreateLabel] = useState("");
  const [createType, setCreateType] = useState<QuestionType>("text");
  const [createOrder, setCreateOrder] = useState("1");
  const [createRequired, setCreateRequired] = useState(false);
  const [createPlaceholder, setCreatePlaceholder] = useState("");
  const [createHelpText, setCreateHelpText] = useState("");
  const [createOptionsText, setCreateOptionsText] = useState("");
  const [createValidationText, setCreateValidationText] = useState("{}");

  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<QuestionType>("text");
  const [editOrder, setEditOrder] = useState("1");
  const [editRequired, setEditRequired] = useState(false);
  const [editPlaceholder, setEditPlaceholder] = useState("");
  const [editHelpText, setEditHelpText] = useState("");
  const [editOptionsText, setEditOptionsText] = useState("");
  const [editValidationText, setEditValidationText] = useState("{}");
  const [editActive, setEditActive] = useState(true);

  const canAccess = meRole === "SUPER_ADMIN" || meRole === "ADMIN";

  const loadQuestions = useCallback(async () => {
    const response = await fetch(
      `/api/admin/form-blocks/${encodeURIComponent(blockId)}/questions`,
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao carregar perguntas.");
      return;
    }
    const body = (await response.json()) as {
      block: BlockSummary;
      questions: QuestionRow[];
    };
    setBlock(body.block);
    setQuestions(body.questions);
  }, [blockId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.replace(
        "/login?redirect=" +
          encodeURIComponent(`/admin/questionarios/blocos/${blockId}/perguntas`),
      );
      return;
    }
    const me = (await meRes.json()) as { user: { role: string } };
    setMeRole(me.user.role);

    if (me.user.role !== "SUPER_ADMIN" && me.user.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    await loadQuestions();
    setLoading(false);
  }, [blockId, loadQuestions, router]);

  useEffect(() => {
    if (!blockId) return;
    void load();
  }, [blockId, load]);

  const onCreateQuestion = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    let parsedOptions: OptionRow[] = [];
    let parsedValidation: Record<string, unknown> | undefined;
    let parsedOrder = 0;

    try {
      parsedOptions = parseOptionsInput(createOptionsText);
      parsedValidation = parseValidationInput(createValidationText);
      parsedOrder = Number(createOrder);
    } catch (inputError) {
      setSaving(false);
      setError(inputError instanceof Error ? inputError.message : "Dados invalidos.");
      return;
    }

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setSaving(false);
      setError("A ordem deve ser um numero inteiro maior ou igual a zero.");
      return;
    }

    const payload: Record<string, unknown> = {
      label: createLabel.trim(),
      type: createType,
      order: parsedOrder,
      requiredDefault: createRequired,
      placeholder: createPlaceholder.trim() || null,
      helpText: createHelpText.trim() || null,
    };
    if (parsedOptions.length > 0) payload.options = parsedOptions;
    if (parsedValidation) payload.validation = parsedValidation;

    const response = await fetch(
      `/api/admin/form-blocks/${encodeURIComponent(blockId)}/questions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao criar pergunta.");
      return;
    }

    setCreateLabel("");
    setCreateType("text");
    setCreateOrder("1");
    setCreateRequired(false);
    setCreatePlaceholder("");
    setCreateHelpText("");
    setCreateOptionsText("");
    setCreateValidationText("{}");
    await loadQuestions();
  };

  const onOpenEditQuestion = (question: QuestionRow) => {
    setEditingQuestion(question);
    setEditLabel(question.label);
    setEditType(question.type);
    setEditOrder(String(question.order));
    setEditRequired(question.requiredDefault);
    setEditPlaceholder(question.placeholder ?? "");
    setEditHelpText(question.helpText ?? "");
    setEditOptionsText(formatOptionsOutput(question.options ?? []));
    setEditValidationText(JSON.stringify(question.validation ?? {}, null, 2));
    setEditActive(question.active);
  };

  const onUpdateQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingQuestion) return;

    setSaving(true);
    setError("");

    let parsedOptions: OptionRow[] = [];
    let parsedValidation: Record<string, unknown> | undefined;
    let parsedOrder = 0;

    try {
      parsedOptions = parseOptionsInput(editOptionsText);
      parsedValidation = parseValidationInput(editValidationText);
      parsedOrder = Number(editOrder);
    } catch (inputError) {
      setSaving(false);
      setError(inputError instanceof Error ? inputError.message : "Dados invalidos.");
      return;
    }

    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setSaving(false);
      setError("A ordem deve ser um numero inteiro maior ou igual a zero.");
      return;
    }

    const payload: Record<string, unknown> = {
      label: editLabel.trim(),
      type: editType,
      order: parsedOrder,
      requiredDefault: editRequired,
      placeholder: editPlaceholder.trim() || null,
      helpText: editHelpText.trim() || null,
      active: editActive,
      options: parsedOptions,
    };
    if (parsedValidation) payload.validation = parsedValidation;

    const response = await fetch(
      `/api/admin/form-questions/${encodeURIComponent(editingQuestion.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao atualizar pergunta.");
      return;
    }

    setEditingQuestion(null);
    await loadQuestions();
  };

  const onToggleQuestion = async (question: QuestionRow) => {
    setSaving(true);
    setError("");

    const response = await fetch(
      `/api/admin/form-questions/${encodeURIComponent(question.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !question.active }),
      },
    );

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao alterar estado da pergunta.");
      return;
    }

    await loadQuestions();
  };

  if (loading) {
    return (
      <AppShell active="admin">
        <p className="text-sm text-surface-500">A carregar...</p>
      </AppShell>
    );
  }

  if (!canAccess) {
    return (
      <AppShell active="admin">
        <AppCard className="max-w-md border-amber-200/80 bg-amber-50/50">
          <p className="text-sm font-medium text-amber-950">Acesso reservado a administradores.</p>
          <Link
            className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:underline"
            href="/dashboard"
          >
            Voltar ao painel
          </Link>
        </AppCard>
      </AppShell>
    );
  }

  return (
    <AppShell active="admin">
      <PageHeader
        title="Perguntas do bloco"
        description="Listar, criar, editar e ativar/desativar perguntas do questionario."
        action={
          <Link className={btnSecondary} href="/admin/questionarios">
            Voltar aos blocos
          </Link>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {block ? (
        <AppCard className="mb-6">
          <p className="text-xs text-surface-500">Bloco</p>
          <h2 className="text-sm font-semibold text-surface-900">
            {block.title} ({block.blockKey})
          </h2>
          <p className="mt-1 text-xs text-surface-600">
            Empresa: {block.company ? `${block.company.name} (${block.company.slug})` : "-"} | Ordem:{" "}
            {block.order}
          </p>
          {block.description ? (
            <p className="mt-2 text-xs text-surface-600">{block.description}</p>
          ) : null}
        </AppCard>
      ) : null}

      <AppCard className="mb-6">
        <h2 className="text-sm font-semibold text-surface-900">Nova pergunta</h2>
        <p className="mb-4 mt-0.5 text-xs text-surface-500">
          Para opcoes use uma linha por item no formato <code>Label|valor</code>.
        </p>

        <form onSubmit={onCreateQuestion} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Label
            <input
              required
              className={inputClass}
              value={createLabel}
              onChange={(event) => setCreateLabel(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            Tipo
            <select
              className={inputClass}
              value={createType}
              onChange={(event) => setCreateType(event.target.value as QuestionType)}
            >
              {questionTypes.map((questionType) => (
                <option key={questionType.value} value={questionType.value}>
                  {questionType.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Ordem
            <input
              required
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={createOrder}
              onChange={(event) => setCreateOrder(event.target.value)}
            />
          </label>
          <label className={labelClass}>
            Placeholder (opcional)
            <input
              className={inputClass}
              value={createPlaceholder}
              onChange={(event) => setCreatePlaceholder(event.target.value)}
            />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Texto de ajuda (opcional)
            <input
              className={inputClass}
              value={createHelpText}
              onChange={(event) => setCreateHelpText(event.target.value)}
            />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Opcoes (quando aplicavel)
            <textarea
              rows={4}
              className={inputClass}
              value={createOptionsText}
              onChange={(event) => setCreateOptionsText(event.target.value)}
              placeholder={"Sim|sim\nNao|nao"}
            />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Validation JSON (opcional)
            <textarea
              rows={4}
              className={inputClass}
              value={createValidationText}
              onChange={(event) => setCreateValidationText(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2.5 text-xs font-medium text-surface-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
              checked={createRequired}
              onChange={(event) => setCreateRequired(event.target.checked)}
            />
            Obrigatoria por padrao
          </label>
          <div className="md:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              Criar pergunta
            </button>
          </div>
        </form>
      </AppCard>

      <AppCard className="overflow-x-auto" padding="p-0 sm:p-0">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-200/90 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
              <th className="px-4 py-3">Ordem</th>
              <th className="px-4 py-3">Field ID</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Obrigatoria</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {questions.map((question) => (
              <tr key={question.id} className="text-surface-800 transition hover:bg-brand-500/8">
                <td className="px-4 py-3">{question.order}</td>
                <td className="px-4 py-3 font-mono text-xs text-surface-600">{question.fieldId}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{question.label}</div>
                  {question.helpText ? (
                    <p className="mt-0.5 max-w-xl text-xs text-surface-500">{question.helpText}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{question.type}</td>
                <td className="px-4 py-3">{question.requiredDefault ? "Sim" : "Nao"}</td>
                <td className="px-4 py-3">
                  {question.active ? (
                    <span className="inline-flex rounded-md bg-emerald-100/90 px-2 py-0.5 text-xs font-medium text-emerald-900">
                      Ativa
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md bg-surface-200/90 px-2 py-0.5 text-xs font-medium text-surface-800">
                      Inativa
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenEditQuestion(question)}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleQuestion(question)}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      {question.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {questions.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-surface-500" colSpan={7}>
                  Nenhuma pergunta encontrada para este bloco.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </AppCard>

      {editingQuestion ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-surface-200/90 bg-surface-0 p-5 shadow-2xl ring-1 ring-surface-950/10 sm:p-6">
            <h2 className="text-sm font-semibold text-surface-900">
              Editar pergunta: {editingQuestion.fieldId}
            </h2>
            <form onSubmit={onUpdateQuestion} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Label
                <input
                  required
                  className={inputClass}
                  value={editLabel}
                  onChange={(event) => setEditLabel(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Tipo
                <select
                  className={inputClass}
                  value={editType}
                  onChange={(event) => setEditType(event.target.value as QuestionType)}
                >
                  {questionTypes.map((questionType) => (
                    <option key={questionType.value} value={questionType.value}>
                      {questionType.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Ordem
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={editOrder}
                  onChange={(event) => setEditOrder(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Placeholder (opcional)
                <input
                  className={inputClass}
                  value={editPlaceholder}
                  onChange={(event) => setEditPlaceholder(event.target.value)}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Texto de ajuda (opcional)
                <input
                  className={inputClass}
                  value={editHelpText}
                  onChange={(event) => setEditHelpText(event.target.value)}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Opcoes (quando aplicavel)
                <textarea
                  rows={4}
                  className={inputClass}
                  value={editOptionsText}
                  onChange={(event) => setEditOptionsText(event.target.value)}
                  placeholder={"Sim|sim\nNao|nao"}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Validation JSON (opcional)
                <textarea
                  rows={4}
                  className={inputClass}
                  value={editValidationText}
                  onChange={(event) => setEditValidationText(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-surface-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                  checked={editRequired}
                  onChange={(event) => setEditRequired(event.target.checked)}
                />
                Obrigatoria por padrao
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-surface-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                  checked={editActive}
                  onChange={(event) => setEditActive(event.target.checked)}
                />
                Pergunta ativa
              </label>
              <div className="md:col-span-2 flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setEditingQuestion(null)}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
