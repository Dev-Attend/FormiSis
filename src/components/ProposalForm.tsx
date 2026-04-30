"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { blocos, defaultValues, type Field } from "@/lib/formSchema";
import { avaliarRegras } from "@/lib/rulesEngine";
import {
  inputCompactClass,
  labelCompactClass,
} from "@/lib/uiClasses";
import { parsePreSalesMeta, type PreSalesStage } from "@/lib/preSalesMeta";
import { etapaPreVendasPt, statusPropostaPt } from "@/lib/uiLabels";

type AuditSnapshot = {
  revisions: Array<{ id: string; createdAt: string; note: string | null; status: string }>;
  audits: Array<{ id: string; action: string; createdAt: string }>;
};

function FieldRenderer({
  field,
  register,
  required,
  disabled,
}: {
  field: Field;
  register: ReturnType<typeof useForm<Record<string, string>>>["register"];
  required: boolean;
  disabled?: boolean;
}) {
  const baseClasses = `${inputCompactClass.replace("mt-0.5 ", "")} disabled:cursor-not-allowed disabled:bg-surface-100`;
  return (
    <label className="flex flex-col gap-0.5 text-sm">
      <span className="text-xs font-medium text-surface-700">
        {field.label} {required ? <span className="text-red-600">*</span> : ""}
      </span>
      {field.type === "textarea" ? (
        <textarea className={baseClasses} rows={2} disabled={disabled} {...register(field.id)} />
      ) : field.type === "select" ? (
        <select className={baseClasses} disabled={disabled} {...register(field.id)}>
          <option value="">Selecione</option>
          {field.options?.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      ) : (
        <input className={baseClasses} type={field.type} disabled={disabled} {...register(field.id)} />
      )}
    </label>
  );
}

export function ProposalForm({
  onClose,
  backHref,
  resumeProposalId,
  onResumeProposalIdConsumed,
  workspaceResetToken,
  newProposalDraft = false,
}: {
  onClose?: () => void;
  /** Volta para a fila de propostas (navegação por URL). */
  backHref?: string;
  resumeProposalId?: string | null;
  onResumeProposalIdConsumed?: () => void;
  /** Incrementado pelo dashboard em "+ Nova" para limpar a area de trabalho. */
  workspaceResetToken?: number;
  /**
   * Rota /propostas/nova: abre formulario sem ID; o usuario clica em Iniciar para POST /api/forms
   * (equivalente a comecar de facto a proposta no servidor).
   */
  newProposalDraft?: boolean;
}) {
  const router = useRouter();
  const [downloadStatus, setDownloadStatus] = useState("");
  const [blockingErrors, setBlockingErrors] = useState<string[]>([]);
  const [activeBlockId, setActiveBlockId] = useState("bloco1");
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionRevision, setSessionRevision] = useState<number | null>(null);
  const [proposalTitle, setProposalTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [opportunityRef, setOpportunityRef] = useState("");
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [warningsCollapsed, setWarningsCollapsed] = useState(true);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPayload, setAuditPayload] = useState<AuditSnapshot | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [preSalesStage, setPreSalesStage] = useState<PreSalesStage>("DRAFTING");
  const lastWorkspaceReset = useRef(0);

  const { register, handleSubmit, control, reset } = useForm<Record<string, string>>({
    defaultValues,
    mode: "onChange",
  });

  const values = useWatch({ control: control });
  const normalizedValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(values ?? {}).map(([k, v]) => [k, v ?? ""]),
      ) as Record<string, string>,
    [values],
  );
  const rules = useMemo(() => avaliarRegras(normalizedValues), [normalizedValues]);
  const visibleBlocks = useMemo(
    () => blocos.filter((b) => rules.visibleBlocks.has(b.id)),
    [rules.visibleBlocks],
  );
  const selectedBlock =
    visibleBlocks.find((b) => b.id === activeBlockId) ?? visibleBlocks[0];
  const selectedBlockIndex = selectedBlock
    ? visibleBlocks.findIndex((b) => b.id === selectedBlock.id)
    : -1;

  const getBlockProgress = (blockId: string) => {
    const block = blocos.find((b) => b.id === blockId);
    if (!block) return { pct: 0, pendingRequired: 0, total: 0, filled: 0 };
    const requiredIds = block.fields
      .filter((f) => f.required || rules.requiredFields.has(f.id))
      .map((f) => f.id);
    const pendingRequired = requiredIds.filter(
      (id) => !String(normalizedValues[id] ?? "").trim(),
    ).length;
    const total = block.fields.length;
    const filled = block.fields.filter((f) =>
      String(normalizedValues[f.id] ?? "").trim(),
    ).length;
    const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
    return { pct, pendingRequired, total, filled };
  };

  const filteredFields = useMemo(() => {
    if (!selectedBlock) return [];
    return selectedBlock.fields.filter((field) => {
      const isRequired = Boolean(field.required) || rules.requiredFields.has(field.id);
      const matchesRequired = !showOnlyRequired || isRequired;
      const matchesSearch =
        !fieldSearch ||
        field.label.toLowerCase().includes(fieldSearch.toLowerCase());
      return matchesRequired && matchesSearch;
    });
  }, [selectedBlock, rules.requiredFields, showOnlyRequired, fieldSearch]);

  useEffect(() => {
    if (!workspaceResetToken) return;
    if (workspaceResetToken === lastWorkspaceReset.current) return;
    lastWorkspaceReset.current = workspaceResetToken;
    reset({ ...defaultValues });
    setCurrentSessionId(null);
    setSessionRevision(null);
    setProposalTitle("");
    setClientName("");
    setOpportunityRef("");
    setProposalStatus(null);
    setReadOnly(false);
    setBlockingErrors([]);
      setWarningsCollapsed(true);
    setActiveBlockId("bloco1");
    setShowOnlyRequired(false);
    setFieldSearch("");
    setAuditOpen(false);
    setAuditPayload(null);
    setPreSalesStage("DRAFTING");
    setDownloadStatus("Area de trabalho limpa. Use Iniciar para registar uma nova proposta no servidor.");
  }, [workspaceResetToken, reset]);


  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const me = (await res.json()) as { user: { role: string } };
      setUserRole(me.user.role);
    })();
  }, []);
  const applyPatchResponse = (payload: unknown) => {
    const body = payload as { revision?: number; status?: string; error?: string };
    if (typeof body.revision === "number") {
      setSessionRevision(body.revision);
    }
    if (typeof body.status === "string") {
      setProposalStatus(body.status);
    }
  };

  const loadProposalById = useCallback(
    async (id: string) => {
      setDownloadStatus("Carregando proposta...");
      const res = await fetch(`/api/forms/${id}`);
      if (!res.ok) {
        setDownloadStatus("Falha ao carregar proposta.");
        return;
      }
      const payload = (await res.json()) as {
        session: {
          payloadJson: string;
          id: string;
          revision: number;
          title: string;
          status: string;
          clientName?: string | null;
          opportunityRef?: string | null;
        };
      };
      const session = payload.session;
      const data = JSON.parse(session.payloadJson || "{}") as Record<string, string>;
      const preSales = parsePreSalesMeta(data);
      setPreSalesStage(preSales.stage);
      reset({ ...defaultValues, ...data });
      setCurrentSessionId(session.id);
      setSessionRevision(session.revision);
      setProposalTitle(session.title);
      setClientName(session.clientName ?? "");
      setOpportunityRef(session.opportunityRef ?? "");
      setProposalStatus(session.status);
      const locked = session.status === "FINALIZED" || session.status === "ARCHIVED";
      setReadOnly(locked);

      if ((session.status === "PAUSED" || session.status === "DRAFT") && preSales.stage !== "UNDER_PRE_SALES_REVIEW") {
        const r = await fetch(`/api/forms/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "IN_PROGRESS",
            expectedRevision: session.revision,
            transitionNote: "Retomada automatica ao abrir a proposta",
          }),
        });
        if (!r.ok) {
          const err = (await r.json()) as { error?: string };
          setDownloadStatus(err.error ?? "Não foi possível retomar a proposta.");
          return;
        }
        applyPatchResponse(await r.json());
      }

      setDownloadStatus("Proposta carregada.");
    },
    [reset],
  );

  useEffect(() => {
    if (!resumeProposalId) return;
    void (async () => {
      await loadProposalById(resumeProposalId);
      onResumeProposalIdConsumed?.();
    })();
  }, [resumeProposalId, loadProposalById, onResumeProposalIdConsumed]);

  const iniciarProposta = async () => {
    const title =
      proposalTitle.trim() ||
      normalizedValues.nome_interno_solicitacao?.trim() ||
      `Proposta ${new Date().toLocaleString("pt-BR")}`;
    setDownloadStatus("Registrando proposta no servidor...");
    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientName: clientName.trim() || undefined,
        opportunityRef: opportunityRef.trim() || undefined,
        payload: normalizedValues,
        warnings: rules.warnings,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setDownloadStatus(
        res.status === 403
          ? (err.error ?? "Sem permissao para criar propostas.")
          : (err.error ?? "Falha ao iniciar proposta."),
      );
      return;
    }
    const payload = (await res.json()) as { id: string };
      setDownloadStatus("Proposta criada. Abrindo...");
    router.replace(`/propostas/${encodeURIComponent(payload.id)}`);
  };

  const pausarSalvar = async () => {
    if (isFormReadOnly) {
      setDownloadStatus("Proposta encerrada: não é possível pausar.");
      return;
    }
    if (!currentSessionId) {
      setDownloadStatus("Inicie a proposta com o botao Iniciar antes de pausar e salvar no servidor.");
      return;
    }
    if (sessionRevision === null) {
      setDownloadStatus("Versao desconhecida: recarregue a proposta.");
      return;
    }
    const title =
      proposalTitle.trim() ||
      normalizedValues.nome_interno_solicitacao?.trim() ||
      "Proposta sem titulo";
    const res = await fetch(`/api/forms/${currentSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientName: clientName.trim() || null,
        opportunityRef: opportunityRef.trim() || null,
        payload: normalizedValues,
        warnings: rules.warnings,
        status: "PAUSED",
        expectedRevision: sessionRevision,
        transitionNote: "Pausa solicitada pelo analista",
      }),
    });
    if (res.status === 409) {
      const body = (await res.json()) as { error?: string; currentRevision?: number };
      if (typeof body.currentRevision === "number") {
        setSessionRevision(body.currentRevision);
      }
      setDownloadStatus(body.error ?? "Conflito de versao ao pausar.");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setDownloadStatus(body.error ?? "Falha ao pausar proposta.");
      return;
    }
    applyPatchResponse(await res.json());
    setDownloadStatus("Proposta pausada, versionada e auditada.");
  };

  const enviarParaValidacaoTecnica = async () => {
    if (!currentSessionId || sessionRevision === null) {
      setDownloadStatus("Recarregue a proposta antes de enviar para a fila do pre-vendas.");
      return;
    }

    const title =
      proposalTitle.trim() ||
      normalizedValues.nome_interno_solicitacao?.trim() ||
      "Proposta sem titulo";

    const res = await fetch(`/api/forms/${currentSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientName: clientName.trim() || null,
        opportunityRef: opportunityRef.trim() || null,
        payload: normalizedValues,
        warnings: rules.warnings,
        expectedRevision: sessionRevision,
        preSalesAction: "SUBMIT_FOR_PRE_SALES",
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; currentRevision?: number };
      if (typeof body.currentRevision === "number") setSessionRevision(body.currentRevision);
      setDownloadStatus(body.error ?? "Falha ao enviar para a fila do pre-vendas.");
      return;
    }

    const body = (await res.json()) as { revision?: number; status?: string; preSalesStage?: PreSalesStage };
    if (typeof body.revision === "number") setSessionRevision(body.revision);
    if (typeof body.status === "string") setProposalStatus(body.status);
    if (body.preSalesStage) setPreSalesStage(body.preSalesStage);

    setDownloadStatus("Enviado para fila do pre-vendas.");

    await loadProposalById(currentSessionId);
  };

  const finalizarProposta = async () => {
    if (isFormReadOnly) {
      setDownloadStatus("Proposta encerrada: finalização indisponível.");
      return;
    }
    if (!currentSessionId || sessionRevision === null) {
      setDownloadStatus("Recarregue a proposta antes de finalizar.");
      return;
    }
    if (preSalesStage !== "APPROVED_PRE_SALES" && userRole !== "ADMIN") {
      setDownloadStatus("A proposta precisa de parecer técnico aprovado pelo pré-vendas antes da finalização.");
      return;
    }

    const title =
      proposalTitle.trim() ||
      normalizedValues.nome_interno_solicitacao?.trim() ||
      "Proposta sem titulo";

    const res = await fetch(`/api/forms/${currentSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientName: clientName.trim() || null,
        opportunityRef: opportunityRef.trim() || null,
        payload: normalizedValues,
        warnings: rules.warnings,
        status: "FINALIZED",
        expectedRevision: sessionRevision,
        transitionNote: "Finalização manual da proposta",
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; currentRevision?: number };
      if (typeof body.currentRevision === "number") setSessionRevision(body.currentRevision);
      setDownloadStatus(body.error ?? "Falha ao finalizar proposta.");
      return;
    }

    const body = (await res.json()) as { revision?: number; status?: string };
    if (typeof body.revision === "number") setSessionRevision(body.revision);
    if (typeof body.status === "string") setProposalStatus(body.status);
    setReadOnly(true);
    setDownloadStatus("Proposta finalizada.");
  };
  const loadAuditTrail = async () => {
    if (!currentSessionId) return;
    setAuditLoading(true);
    setAuditOpen(true);
    try {
      const res = await fetch(`/api/forms/${currentSessionId}/revisions`);
      if (!res.ok) {
        setAuditPayload(null);
        return;
      }
      setAuditPayload((await res.json()) as AuditSnapshot);
    } finally {
      setAuditLoading(false);
    }
  };

  const isCommercial = userRole === "COMERCIAL";
  const isCommercialLockedByStage =
    isCommercial &&
    (preSalesStage === "UNDER_PRE_SALES_REVIEW" || preSalesStage === "APPROVED_PRE_SALES");
  const isFormReadOnly = readOnly || isCommercialLockedByStage;
  const totalFilledFields = useMemo(
    () =>
      Object.values(normalizedValues).filter((value) => String(value ?? "").trim()).length,
    [normalizedValues],
  );
  const missingRequiredForPreSales = useMemo(() => {
    const requiredBySchema = blocos
      .filter((b) => rules.visibleBlocks.has(b.id))
      .flatMap((b) => b.fields)
      .filter((f) => f.required)
      .map((f) => f.id);
    const requiredByRules = Array.from(rules.requiredFields);
    const allRequired = new Set([...requiredBySchema, ...requiredByRules]);
    return Array.from(allRequired).filter((fieldId) => !String(normalizedValues[fieldId] ?? "").trim());
  }, [rules.visibleBlocks, rules.requiredFields, normalizedValues]);

  const onSubmit = async (data: Record<string, string>) => {
    if (isFormReadOnly) {
      setDownloadStatus("Proposta encerrada: geracao bloqueada.");
      return;
    }
    if (!currentSessionId) {
      setDownloadStatus("Clique em Iniciar para criar a proposta no servidor antes de gerar o documento.");
      return;
    }
    if (preSalesStage !== "APPROVED_PRE_SALES" && userRole !== "ADMIN") {
      setDownloadStatus("A proposta precisa de parecer técnico aprovado pelo pré-vendas antes da finalização.");
      return;
    }
    const requiredBySchema = blocos
      .filter((b) => rules.visibleBlocks.has(b.id))
      .flatMap((b) => b.fields)
      .filter((f) => f.required)
      .map((f) => f.id);
    const requiredByRules = Array.from(rules.requiredFields);
    const allRequired = new Set([...requiredBySchema, ...requiredByRules]);
    const missing = Array.from(allRequired).filter(
      (fieldId) => !String(data[fieldId] ?? "").trim(),
    );

    const submitErrors = [
      ...rules.errors,
      ...missing.map((f) => `Campo obrigatório não preenchido: ${f}`),
    ];
    setBlockingErrors(submitErrors);
    if (submitErrors.length > 0) {
      setDownloadStatus("Envio bloqueado por validacoes obrigatorias.");
      return;
    }

    if (currentSessionId && sessionRevision === null) {
      setDownloadStatus("Sincronize a proposta antes de finalizar (recarregue).");
      return;
    }

    const res = await fetch("/api/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data,
        sessionId: currentSessionId ?? undefined,
        expectedRevision: currentSessionId ? sessionRevision : undefined,
      }),
    });
    if (!res.ok) {
      let message = "Falha na geração do documento.";
      try {
        const payload = (await res.json()) as { details?: string[]; error?: string; currentRevision?: number };
        if (payload.currentRevision !== undefined) {
          setSessionRevision(payload.currentRevision);
        }
        if (payload.details?.length) {
          setBlockingErrors(payload.details);
          message = payload.error ?? message;
        } else if (payload.error) {
          message = payload.error;
        }
      } catch {
        // sem payload json
      }
      setDownloadStatus(message);
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    const contentDisposition = res.headers.get("content-disposition") ?? "";
    const filename = contentDisposition.includes("filename=")
      ? contentDisposition.split("filename=")[1].replaceAll('"', "")
      : "documento-tecnico.docx";
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    setBlockingErrors([]);
    setDownloadStatus(`Documento gerado: ${filename}`);
    if (currentSessionId) {
      const sync = await fetch(`/api/forms/${currentSessionId}`);
      if (sync.ok) {
        const bodyJson = (await sync.json()) as {
          session: { revision: number; status: string };
        };
        setSessionRevision(bodyJson.session.revision);
        setProposalStatus(bodyJson.session.status);
      } else {
        setProposalStatus("FINALIZED");
      }
      setReadOnly(true);
    }
  };

  const headingTitle =
    proposalTitle.trim() ||
    (newProposalDraft && !currentSessionId
      ? "Nova (rascunho)"
      : currentSessionId
        ? "Proposta sem título"
        : "Proposta técnica comercial");
  const topBarBtnBase =
    "inline-flex min-w-[110px] items-center justify-center rounded-md border border-surface-300 bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-800 transition hover:bg-surface-200 disabled:cursor-not-allowed disabled:opacity-50";
  const topBarBtnPrimary =
    "inline-flex min-w-[110px] items-center justify-center rounded-md border border-brand-500 bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-0 px-1.5 py-1 sm:px-2 sm:py-1.5">
      <div className="mb-0.5 border-b border-surface-200/70 pb-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[11px] font-semibold leading-tight text-surface-900 sm:text-xs">
              {headingTitle}
            </h2>
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-1">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className={topBarBtnBase}
              >
                Fechar
              </button>
            ) : (
              <span className={`${topBarBtnBase} invisible`} aria-hidden="true">
                Fechar
              </span>
            )}
            <button
              type="button"
              onClick={() => void iniciarProposta()}
              disabled={readOnly || Boolean(currentSessionId) || !newProposalDraft}
              className={topBarBtnPrimary}
            >
              Iniciar
            </button>
            <button
              type="button"
              onClick={() => void pausarSalvar()}
              disabled={isFormReadOnly || !currentSessionId}
              title={!currentSessionId ? "Disponivel apos Iniciar" : undefined}
              className={topBarBtnBase}
            >
              Pausar e salvar
            </button>
            <button
              type="button"
              onClick={() => void enviarParaValidacaoTecnica()}
              disabled={
                isFormReadOnly ||
                !currentSessionId ||
                !(
                  (preSalesStage === "DRAFTING" || preSalesStage === "CHANGES_REQUESTED") &&
                  (userRole === "COMERCIAL" || userRole === "ADMIN")
                ) ||
                missingRequiredForPreSales.length > 0
              }
              title={
                missingRequiredForPreSales.length > 0
                  ? `Preencha ${missingRequiredForPreSales.length} campo(s) obrigatório(s) antes de enviar.`
                  : undefined
              }
              className={topBarBtnBase}
            >
              Enviar para fila do pre-vendas
            </button>
          </div>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-1 gap-1 lg:grid-cols-3">
        <input
          className={inputCompactClass}
          value={proposalTitle}
          disabled={isFormReadOnly}
          onChange={(e) => setProposalTitle(e.target.value)}
          placeholder="Titulo interno"
        />
        <input
          className={inputCompactClass}
          value={clientName}
          disabled={isFormReadOnly}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Cliente / empresa"
        />
        <input
          className={inputCompactClass}
          value={opportunityRef}
          disabled={isFormReadOnly}
          onChange={(e) => setOpportunityRef(e.target.value)}
          placeholder="CRM / oportunidade"
        />
      </div>


      {auditOpen && (
        <div className="mb-3 rounded-lg border border-surface-200 bg-surface-50 p-3 text-xs text-surface-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-surface-800">Trilha de auditoria e revisoes</span>
            <button type="button" className="text-blue-700 hover:underline" onClick={() => setAuditOpen(false)}>
              Fechar
            </button>
          </div>
          {auditLoading && <p>Carregando...</p>}
          {!auditLoading && auditPayload && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 font-semibold text-surface-800">Revisoes persistidas</p>
                <ul className="max-h-48 space-y-1 overflow-auto rounded border border-surface-200 bg-surface-0 p-2">
                  {auditPayload.revisions.map((r) => (
                    <li key={r.id} className="border-b border-surface-100 pb-1 last:border-0">
                      <span className="font-mono text-[10px] text-surface-500">{r.id.slice(0, 8)}...</span>{" "}
                      <span className="text-[10px] text-surface-500">
                        {new Date(r.createdAt).toLocaleString("pt-BR")}
                      </span>
                      <div className="text-[11px]">{r.note ?? "?"}</div>
                      <div className="text-[10px] uppercase text-surface-500">{r.status}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-semibold text-surface-800">Eventos de auditoria</p>
                <ul className="max-h-48 space-y-1 overflow-auto rounded border border-surface-200 bg-surface-0 p-2">
                  {auditPayload.audits.map((a) => (
                    <li key={a.id} className="border-b border-surface-100 pb-1 last:border-0">
                      <span className="font-semibold text-surface-800">{a.action}</span>
                      <div className="text-[10px] text-surface-500">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {blockingErrors.length > 0 && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm">
          <h2 className="font-semibold text-red-700">Erros bloqueantes</h2>
          <ul className="list-disc pl-6 text-sm text-red-700">
            {blockingErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {rules.warnings.length > 0 && totalFilledFields >= 5 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-amber-700">Alertas de regra ({rules.warnings.length})</h2>
            <button
              type="button"
              onClick={() => setWarningsCollapsed((old) => !old)}
              className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-200"
              aria-expanded={!warningsCollapsed}
            >
              {warningsCollapsed ? "Expandir" : "Recolher"}
            </button>
          </div>
          {!warningsCollapsed ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
              {rules.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-0.5 flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-[minmax(200px,16rem)_1fr]">
          <aside className="min-h-0 overflow-y-auto rounded-lg border border-surface-200/80 bg-surface-50/50 p-1.5 shadow-sm">
            <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-surface-500">Blocos</h2>
            <div className="flex flex-col gap-1">
              {visibleBlocks.map((bloco) => {
                const progress = getBlockProgress(bloco.id);
                const isActive = selectedBlock?.id === bloco.id;
                return (
                  <button
                    key={bloco.id}
                    type="button"
                    onClick={() => setActiveBlockId(bloco.id)}
                    className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                      isActive
                        ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                        : "border-surface-200/80 bg-surface-0 hover:border-surface-300 hover:bg-surface-0"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="min-w-0 flex-1 whitespace-normal leading-tight">{bloco.title}</span>
                      <span className="shrink-0 text-[10px] tabular-nums opacity-80">{progress.pct}%</span>
                    </div>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${
                        progress.pendingRequired > 0
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {progress.pendingRequired} obrigatório(s) pendente(s)
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto rounded-lg border border-surface-200/80 bg-surface-0 p-2 shadow-sm sm:p-2.5">
            {selectedBlock ? (
              <>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <h2 className="text-sm font-semibold leading-tight text-surface-900">{selectedBlock.title}</h2>
                  <span className="rounded bg-surface-100 px-2 py-0.5 text-[10px] text-surface-600">
                    {selectedBlock.fields.length} campos
                  </span>
                </div>
                <div className="mb-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_auto]">
                  <input
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Buscar neste bloco?"
                    className="w-full rounded-lg border border-surface-200 px-2 py-1.5 text-xs"
                    disabled={isFormReadOnly}
                  />
                  <label className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-surface-200 px-2 py-1.5 text-[10px] text-surface-600">
                    <input
                      type="checkbox"
                      checked={showOnlyRequired}
                      onChange={(e) => setShowOnlyRequired(e.target.checked)}
                      disabled={isFormReadOnly}
                    />
                    Mostrar apenas obrigatórios
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {filteredFields.map((field) => (
                    <FieldRenderer
                      key={field.id}
                      field={field}
                      register={register}
                      required={Boolean(field.required) || rules.requiredFields.has(field.id)}
                      disabled={isFormReadOnly}
                    />
                  ))}
                </div>
                {filteredFields.length === 0 && (
                  <p className="mt-3 text-sm text-surface-500">
                    Nenhum campo encontrado para o filtro atual.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-surface-600">Nenhum bloco disponível para exibição.</p>
            )}
          </section>
        </div>

        <div className="mt-auto flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-surface-200/90 bg-surface-0 px-2 py-1.5 text-xs shadow-sm">
          <button
            type="button"
            disabled={selectedBlockIndex <= 0 || isFormReadOnly}
            onClick={() => {
              const prev = visibleBlocks[selectedBlockIndex - 1];
              if (prev) setActiveBlockId(prev.id);
            }}
            className="rounded-md border border-surface-300 bg-surface-0 px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={selectedBlockIndex >= visibleBlocks.length - 1 || isFormReadOnly}
            onClick={() => {
              const next = visibleBlocks[selectedBlockIndex + 1];
              if (next) setActiveBlockId(next.id);
            }}
            className="rounded-md border border-surface-300 bg-surface-0 px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Próximo
          </button>
          <button
            className="rounded-md bg-surface-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-surface-800 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => void finalizarProposta()}
            disabled={isFormReadOnly}
          >
            Finalizar proposta
          </button>
          <button
            type="button"
            onClick={() => void loadAuditTrail()}
            disabled={!currentSessionId}
            className="rounded-md border border-surface-300 bg-surface-0 px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Auditoria
          </button>
          <span className="rounded bg-surface-100 px-2 py-1 text-[10px] font-medium text-surface-700">
            Bloco {selectedBlockIndex + 1} de {visibleBlocks.length} ?{" "}
            {selectedBlock ? getBlockProgress(selectedBlock.id).pct : 0}%
          </span>
          <button
            className="rounded-md border border-surface-800 bg-surface-0 px-2.5 py-1 text-xs font-medium text-surface-900 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isFormReadOnly}
            onClick={handleSubmit(onSubmit)}
          >
            Gerar DOCX
          </button>
          <button
            className="rounded-md border border-surface-800 bg-surface-0 px-2.5 py-1 text-xs font-medium text-surface-900 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isFormReadOnly}
            onClick={() =>
              handleSubmit((data) => onSubmit({ ...data, _output_format: "pdf" }))()
            }
          >
            Gerar PDF
          </button>
          {downloadStatus && (
            <span className="self-center pl-0.5 text-[11px] text-surface-500">{downloadStatus}</span>
          )}
        </div>
      </form>
    </div>
  );
}

















