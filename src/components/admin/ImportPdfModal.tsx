"use client";

import { useState, type ChangeEvent } from "react";
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

type Option = { label: string; value: string };

type PreviewQuestion = {
  fieldId: string;
  label: string;
  type: QuestionType;
  options: Option[] | null;
  order: number;
  requiredDefault: boolean;
  collidesWith: boolean;
};

type Collision = {
  existingBlockId: string;
  existingTitle: string;
  existingQuestionCount: number;
} | null;

type PreviewBlock = {
  blockKey: string;
  title: string;
  description: string | null;
  order: number;
  questions: PreviewQuestion[];
  collision: Collision;
};

type EditableBlock = PreviewBlock & {
  strategy: "replace" | "skip" | "rename";
};

type ParseResponse = {
  company: { id: string; name: string; slug: string };
  blocks: PreviewBlock[];
};

type CommitResult = {
  blockKey: string;
  status: "created" | "replaced" | "skipped" | "renamed";
  blockId?: string;
};

type Step = "upload" | "preview" | "done";

const TYPE_LABELS: Record<QuestionType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Numero",
  select: "Lista (select)",
  radio: "Opcoes (radio)",
  checkbox: "Checkbox (multi)",
  date: "Data",
  boolean: "Sim/Nao",
};

const TYPES_WITH_OPTIONS: QuestionType[] = ["select", "radio", "checkbox"];

type ImportPdfModalProps = {
  open: boolean;
  companyId: string;
  onClose: () => void;
  onCompleted: () => void;
};

export function ImportPdfModal({ open, companyId, onClose, onCompleted }: ImportPdfModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [results, setResults] = useState<CommitResult[]>([]);
  const [companyLabel, setCompanyLabel] = useState("");
  const [debugPreview, setDebugPreview] = useState<{
    textLength: number;
    preview: string;
  } | null>(null);
  const [validationDetails, setValidationDetails] = useState<string | null>(null);

  if (!open) return null;

  const resetAll = () => {
    setStep("upload");
    setBusy(false);
    setError("");
    setFile(null);
    setBlocks([]);
    setResults([]);
    setCompanyLabel("");
    setDebugPreview(null);
    setValidationDetails(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const next = event.target.files?.[0] ?? null;
    setFile(next);
  };

  const handleParse = async () => {
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    setBusy(true);
    setError("");
    setDebugPreview(null);
    const body = new FormData();
    body.append("file", file);
    if (companyId) body.append("companyId", companyId);

    const response = await fetch("/api/admin/form-blocks/import/parse", {
      method: "POST",
      body,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        debug?: { textLength: number; preview: string };
      };
      setError(data.error ?? "Falha ao processar o PDF.");
      if (data.debug) setDebugPreview(data.debug);
      setBusy(false);
      return;
    }

    const data = (await response.json()) as ParseResponse;
    setCompanyLabel(`${data.company.name} (${data.company.slug})`);
    setBlocks(
      data.blocks.map((block) => ({
        ...block,
        strategy: block.collision ? "skip" : "replace",
      })),
    );
    setStep("preview");
    setBusy(false);
  };

  const updateBlock = (index: number, patch: Partial<EditableBlock>) => {
    setBlocks((prev) => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  };

  const updateQuestion = (
    blockIndex: number,
    questionIndex: number,
    patch: Partial<PreviewQuestion>,
  ) => {
    setBlocks((prev) =>
      prev.map((block, i) => {
        if (i !== blockIndex) return block;
        return {
          ...block,
          questions: block.questions.map((q, qi) =>
            qi === questionIndex ? { ...q, ...patch } : q,
          ),
        };
      }),
    );
  };

  const handleCommit = async () => {
    setBusy(true);
    setError("");
    setValidationDetails(null);

    const payload = {
      companyId: companyId || undefined,
      blocks: blocks.map((block) => ({
        blockKey: block.blockKey.trim(),
        title: block.title.trim(),
        description: block.description?.trim() || null,
        order: block.order,
        strategy: block.strategy,
        questions: block.questions.map((q) => ({
          fieldId: q.fieldId.trim(),
          label: q.label.trim(),
          type: q.type,
          requiredDefault: q.requiredDefault,
          options: TYPES_WITH_OPTIONS.includes(q.type) ? q.options ?? undefined : undefined,
          order: q.order,
        })),
      })),
    };

    const response = await fetch("/api/admin/form-blocks/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: unknown;
      };
      setError(data.error ?? "Falha ao importar.");
      if (data.details) {
        setValidationDetails(JSON.stringify(data.details, null, 2));
      }
      setBusy(false);
      return;
    }

    const data = (await response.json()) as { results: CommitResult[] };
    setResults(data.results);
    setStep("done");
    setBusy(false);
    onCompleted();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
    >
      <div className="my-8 w-full max-w-5xl rounded-2xl border border-surface-200/90 bg-surface-0 p-5 shadow-2xl ring-1 ring-surface-950/10 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-surface-900">Importar PDF</h2>
            <p className="mt-0.5 text-xs text-surface-500">
              Suba um questionario em PDF para criar blocos e perguntas automaticamente.
            </p>
            {companyLabel ? (
              <p className="mt-1 text-xs text-surface-500">Empresa: {companyLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-medium text-surface-500 hover:text-surface-800"
          >
            Fechar
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        {debugPreview ? (
          <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-950">
            <p className="font-medium">
              Diagnostico: texto extraido tem {debugPreview.textLength} caractere(s).
            </p>
            <p className="mt-1 text-amber-900">Primeiros 800 caracteres do texto:</p>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface-0/80 p-2 font-mono text-[11px] text-surface-900">
              {debugPreview.preview || "(vazio)"}
            </pre>
          </div>
        ) : null}

        {validationDetails ? (
          <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-950">
            <p className="font-medium">Detalhes da validacao:</p>
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-surface-0/80 p-2 font-mono text-[11px] text-surface-900">
              {validationDetails}
            </pre>
          </div>
        ) : null}

        {step === "upload" ? (
          <div className="mt-5 space-y-4">
            <label className={labelClass}>
              Arquivo PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className={inputClass}
              />
            </label>
            <p className="text-xs text-surface-500">
              O parser detecta blocos no padrao <code className="font-mono">N. Titulo</code> e perguntas
              numeradas dentro de cada bloco.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={handleClose}>
                Cancelar
              </button>
              <button type="button" className={btnPrimary} onClick={handleParse} disabled={busy || !file}>
                {busy ? "Processando..." : "Analisar PDF"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="mt-5 space-y-5">
            <p className="text-xs text-surface-500">
              Revise blocos, perguntas e tipos sugeridos. Voce pode editar tudo antes de salvar.
            </p>

            <div className="space-y-5">
              {blocks.map((block, blockIndex) => (
                <div
                  key={`${blockIndex}-${block.blockKey}`}
                  className="rounded-2xl border border-surface-200/90 bg-surface-50/40 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className={labelClass}>
                      Titulo do bloco
                      <input
                        className={inputClass}
                        value={block.title}
                        onChange={(event) => updateBlock(blockIndex, { title: event.target.value })}
                      />
                    </label>
                    <label className={labelClass}>
                      Chave do bloco
                      <input
                        className={inputClass}
                        value={block.blockKey}
                        onChange={(event) => updateBlock(blockIndex, { blockKey: event.target.value })}
                      />
                    </label>
                    <label className={labelClass}>
                      Ordem
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        value={block.order}
                        onChange={(event) =>
                          updateBlock(blockIndex, { order: Number(event.target.value) || 0 })
                        }
                      />
                    </label>
                  </div>

                  {block.collision ? (
                    <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-950">
                      <p className="font-medium">
                        Conflito: ja existe bloco {block.collision.existingTitle} com {block.collision.existingQuestionCount} pergunta(s).
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {(["skip", "replace", "rename"] as const).map((strategy) => (
                          <label key={strategy} className="inline-flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`strategy-${blockIndex}`}
                              checked={block.strategy === strategy}
                              onChange={() => updateBlock(blockIndex, { strategy })}
                            />
                            {strategy === "skip"
                              ? "Pular"
                              : strategy === "replace"
                                ? "Substituir (apaga perguntas antigas)"
                                : "Renomear chave"}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-surface-200/90 text-[11px] font-medium uppercase tracking-wide text-surface-500">
                          <th className="px-2 py-2 w-10">#</th>
                          <th className="px-2 py-2">Label</th>
                          <th className="px-2 py-2 w-40">fieldId</th>
                          <th className="px-2 py-2 w-40">Tipo</th>
                          <th className="px-2 py-2">Opcoes</th>
                          <th className="px-2 py-2 w-20">Obrig.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {block.questions.map((question, qIndex) => (
                          <tr key={`${qIndex}-${question.fieldId}`} className="align-top">
                            <td className="px-2 py-2 text-surface-500">{question.order}</td>
                            <td className="px-2 py-2">
                              <input
                                className={inputClass}
                                value={question.label}
                                onChange={(event) =>
                                  updateQuestion(blockIndex, qIndex, { label: event.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className={`${inputClass} font-mono text-xs`}
                                value={question.fieldId}
                                onChange={(event) =>
                                  updateQuestion(blockIndex, qIndex, { fieldId: event.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                className={inputClass}
                                value={question.type}
                                onChange={(event) => {
                                  const next = event.target.value as QuestionType;
                                  const patch: Partial<PreviewQuestion> = { type: next };
                                  if (TYPES_WITH_OPTIONS.includes(next) && !question.options?.length) {
                                    patch.options = [
                                      { label: "Sim", value: "sim" },
                                      { label: "Nao", value: "nao" },
                                    ];
                                  }
                                  updateQuestion(blockIndex, qIndex, patch);
                                }}
                              >
                                {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                                  <option key={t} value={t}>
                                    {TYPE_LABELS[t]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              {TYPES_WITH_OPTIONS.includes(question.type) ? (
                                <input
                                  className={inputClass}
                                  placeholder="label:valor, label:valor"
                                  value={(question.options ?? [])
                                    .map((o) => `${o.label}:${o.value}`)
                                    .join(", ")}
                                  onChange={(event) => {
                                    const next = event.target.value
                                      .split(",")
                                      .map((entry) => entry.trim())
                                      .filter(Boolean)
                                      .map((entry) => {
                                        const [label, value] = entry.split(":").map((p) => p?.trim());
                                        return { label: label || entry, value: value || label || entry };
                                      });
                                    updateQuestion(blockIndex, qIndex, { options: next });
                                  }}
                                />
                              ) : (
                                <span className="text-surface-400">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                                checked={question.requiredDefault}
                                onChange={(event) =>
                                  updateQuestion(blockIndex, qIndex, {
                                    requiredDefault: event.target.checked,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" className={btnSecondary} onClick={handleClose}>
                Cancelar
              </button>
              <button type="button" className={btnPrimary} onClick={handleCommit} disabled={busy}>
                {busy ? "Importando..." : `Importar ${blocks.length} bloco(s)`}
              </button>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="mt-5 space-y-3">
            <p className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Importacao concluida. Resumo abaixo.
            </p>
            <ul className="rounded-2xl border border-surface-200/90 divide-y divide-surface-100 text-sm">
              {results.map((result, idx) => (
                <li key={idx} className="flex items-center justify-between px-4 py-2">
                  <span className="font-mono text-xs text-surface-700">{result.blockKey}</span>
                  <span className="text-xs uppercase tracking-wide text-surface-500">{result.status}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button type="button" className={btnPrimary} onClick={handleClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
