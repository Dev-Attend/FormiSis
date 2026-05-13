"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppCard } from "@/components/AppCard";
import { AppShell } from "@/components/AppShell";
import { ProposalForm } from "@/components/ProposalForm";
import type { Block } from "@/lib/formSchema";
import { mapTenantBlocksToFormBlocks, type TenantSchemaResponse } from "@/lib/formSchemaAdapter";
import { listMissingMappedEvidence, listMissingMappedFieldIds } from "@/lib/preSalesValidationMap";
import { avaliarRegras } from "@/lib/rulesEngine";
import {
  defaultPreSalesChecklist,
  isChecklistComplete,
  parsePreSalesMeta,
  type PreSalesChecklist,
  type PreSalesStage,
} from "@/lib/preSalesMeta";
import { listMissingRequiredFields, PRE_SALES_INTERNAL_BLOCK_ID } from "@/lib/rulesEngine";
import { etapaPreVendasPt, statusPropostaPt } from "@/lib/uiLabels";

type SessionPayload = {
  id: string;
  title: string;
  status: string;
  revision: number;
  payloadJson: string;
  createdBy?: { id: string; name: string; email: string };
};

const checklistLabels: Record<keyof PreSalesChecklist, string> = {
  scopeValidated: "Escopo e requisitos",
  technicalFeasibilityValidated: "Viabilidade técnica",
  sizingValidated: "Dimensionamento",
  slaValidated: "SLA e premissas comerciais",
  risksValidated: "Riscos e restrições",
  complianceValidated: "Compliance e segurança",
};

export default function PreVendasValidacaoPorIdPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [schemaBlocks, setSchemaBlocks] = useState<Block[]>([]);
  const [stage, setStage] = useState<PreSalesStage>("DRAFTING");
  const [checklist, setChecklist] = useState<PreSalesChecklist>({ ...defaultPreSalesChecklist });
  const [comment, setComment] = useState("");
  const [requestedFieldIds, setRequestedFieldIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    const [meRes, formRes, schemaRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch(`/api/forms/${id}`),
      fetch("/api/forms/schema"),
    ]);
    let reviewer = false;
    if (meRes.ok) {
      const me = (await meRes.json()) as { user: { role: string } };
      setUserRole(me.user.role);
      reviewer = me.user.role === "PRE_VENDAS" || me.user.role === "ADMIN";
    }
    if (!formRes.ok) {
      setError("Falha ao carregar proposta para validação.");
      setLoading(false);
      return;
    }
    if (!schemaRes.ok) {
      setError("Falha ao carregar schema do formulario.");
      setLoading(false);
      return;
    }
    const schemaPayload = (await schemaRes.json()) as TenantSchemaResponse;
    const blocks = mapTenantBlocksToFormBlocks(schemaPayload.blocks);
    setSchemaBlocks(blocks);

    const body = (await formRes.json()) as { session: SessionPayload };
    setSession(body.session);
    const p = JSON.parse(body.session.payloadJson || "{}") as Record<string, string>;
    setPayload(p);
    const rules = avaliarRegras(p);
    const blockIds = new Set(
      blocks.filter((b) => rules.visibleBlocks.has(b.id)).map((b) => b.id),
    );
    if (reviewer) blockIds.add(PRE_SALES_INTERNAL_BLOCK_ID);
    const visibleFieldIds = new Set(
      blocks.filter((b) => blockIds.has(b.id)).flatMap((b) => b.fields.map((f) => f.id)),
    );
    const meta = parsePreSalesMeta(p);
    setStage(meta.stage);
    setChecklist({ ...meta.checklist });
    setComment(meta.lastComment ?? "");
    setRequestedFieldIds(
      meta.requestedFieldIds && meta.requestedFieldIds.length > 0
        ? meta.requestedFieldIds.filter((fieldId) => visibleFieldIds.has(fieldId))
        : listMissingMappedFieldIds(p, visibleFieldIds),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const isReviewer = userRole === "PRE_VENDAS" || userRole === "ADMIN";
  const inPreSalesQueue = stage === "UNDER_PRE_SALES_REVIEW";
  const checklistKeys = Object.keys(checklistLabels) as Array<keyof PreSalesChecklist>;
  const checklistDoneCount = checklistKeys.filter((k) => checklist[k]).length;
  const missingRequired = useMemo(
    () =>
      listMissingRequiredFields(payload, {
        extraRequiredBlockIds:
          userRole === "PRE_VENDAS" || userRole === "ADMIN"
            ? [PRE_SALES_INTERNAL_BLOCK_ID]
            : undefined,
        schemaBlocks,
      }),
    [payload, userRole, schemaBlocks],
  );
  const missingMapped = useMemo(() => {
    const rules = avaliarRegras(payload);
    const blockIds = new Set(
      schemaBlocks.filter((b) => rules.visibleBlocks.has(b.id)).map((b) => b.id),
    );
    if (userRole === "PRE_VENDAS" || userRole === "ADMIN") {
      blockIds.add(PRE_SALES_INTERNAL_BLOCK_ID);
    }
    const visibleFieldIds = new Set(
      schemaBlocks.filter((b) => blockIds.has(b.id)).flatMap((b) => b.fields.map((f) => f.id)),
    );
    return listMissingMappedEvidence(payload, visibleFieldIds);
  }, [payload, userRole, schemaBlocks]);
  const cannotApproveTechnical = missingRequired.length > 0 || missingMapped.length > 0;
  const fieldInfoById = useMemo(() => {
    const m = new Map<string, { block: string; label: string }>();
    for (const b of schemaBlocks) {
      for (const f of b.fields) {
        m.set(f.id, { block: b.title, label: f.label });
      }
    }
    return m;
  }, [schemaBlocks]);

  const saveDraft = async () => {
    if (!session || !isReviewer) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/forms/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: session.revision,
        preSalesChecklist: checklist,
        preSalesComment: comment,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao salvar revisão.");
      return;
    }
    await load();
  };

  const executeAction = async (action: "REQUEST_CHANGES" | "APPROVE_TECHNICAL") => {
    if (!session || !isReviewer) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/forms/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: session.revision,
        preSalesAction: action,
        preSalesChecklist: checklist,
        preSalesComment: comment,
        preSalesRequestedFieldIds: action === "REQUEST_CHANGES" ? requestedFieldIds : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao registrar parecer técnico.");
      return;
    }
    await load();
  };

  if (!id) {
    return (
      <AppShell active="validacoes">
        <p className="text-sm text-surface-500">ID inválido.</p>
      </AppShell>
    );
  }

  return (
    <AppShell active="validacoes">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-surface-900">Pré-vendas</h1>
          <p className="mt-0.5 text-[11px] text-surface-500">
            Mesmo formulário do comercial para leitura técnica + decisão de pré-vendas.
          </p>
        </div>
        <Link
          href={`/propostas/${encodeURIComponent(id)}`}
          className="rounded-md border border-surface-200 bg-surface-0 px-2 py-1 text-[11px] font-medium text-surface-700 hover:bg-surface-50"
        >
          Abrir no fluxo comercial
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-surface-500">Carregando validação...</p>
      ) : !session ? (
        <p className="text-sm text-surface-500">Proposta não encontrada.</p>
      ) : (
        <div className="space-y-2">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}

          <AppCard className="overflow-hidden p-0">
            <div className="border-b border-surface-100 px-3 py-2 text-[11px] text-surface-600">
              {session.title} · Rev. {session.revision} · {statusPropostaPt(session.status)} · {etapaPreVendasPt(stage)}
              {session.createdBy?.name ? ` · Comercial: ${session.createdBy.name}` : ""}
            </div>
            <div className="h-[58vh] min-h-[420px]">
              <ProposalForm
                resumeProposalId={id}
                backHref="/pre-vendas/validacoes"
                mode="preSalesReview"
                reviewRequestedFieldIds={requestedFieldIds}
                onReviewRequestedFieldIdsChange={setRequestedFieldIds}
              />
            </div>
          </AppCard>

          <AppCard>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-2">
              <h2 className="text-sm font-semibold text-surface-900">Decisão técnica do pré-vendas</h2>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={!isReviewer || saving || !inPreSalesQueue}
                className="rounded-md border border-surface-300 bg-surface-0 px-2.5 py-1 text-[11px] font-medium text-surface-800 disabled:opacity-50"
              >
                Salvar rascunho
              </button>
            </div>

            {!inPreSalesQueue ? (
              <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                Etapa atual: {etapaPreVendasPt(stage)}. As ações abaixo só ficam disponíveis em validação técnica.
              </p>
            ) : null}

            <div className="mb-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {checklistKeys.map((k) => (
                <label key={k} className="flex items-start gap-2 rounded-md border border-surface-200 px-2 py-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={checklist[k]}
                    disabled={!isReviewer || !inPreSalesQueue}
                    onChange={(e) => setChecklist((old) => ({ ...old, [k]: e.target.checked }))}
                  />
                  <span>{checklistLabels[k]}</span>
                </label>
              ))}
            </div>

            <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-surface-600">
              <span>
                Checklist: <strong className="text-surface-900">{checklistDoneCount}/{checklistKeys.length}</strong>
              </span>
              <span>
                Obrigatórios vazios: <strong className={missingRequired.length > 0 ? "text-amber-800" : "text-emerald-700"}>{missingRequired.length}</strong>
              </span>
              <span>
                Itens técnicos sem resposta: <strong className={missingMapped.length > 0 ? "text-amber-800" : "text-emerald-700"}>{missingMapped.length}</strong>
              </span>
              <span>
                Itens marcados para revisão: <strong className={requestedFieldIds.length > 0 ? "text-amber-800" : "text-surface-700"}>{requestedFieldIds.length}</strong>
              </span>
            </div>
            {missingMapped.length > 0 ? (
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                <p className="text-[11px] font-medium text-amber-900">
                  Itens técnicos sem resposta ({missingMapped.length}) — o comercial precisa preencher antes de aprovação:
                </p>
                <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto text-[10px] text-amber-900">
                  {missingMapped.slice(0, 12).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {missingMapped.length > 12 ? (
                  <p className="mt-1 text-[10px] text-amber-800">... e mais {missingMapped.length - 12} item(ns).</p>
                ) : null}
              </div>
            ) : null}
            {requestedFieldIds.length > 0 ? (
              <div className="mb-2 rounded-md border border-surface-200 bg-surface-50 px-2.5 py-2">
                <p className="text-[11px] font-medium text-surface-800">
                  Itens selecionados para solicitar ajuste ({requestedFieldIds.length})
                </p>
                <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto text-[10px] text-surface-700">
                  {requestedFieldIds.map((fieldId) => {
                    const info = fieldInfoById.get(fieldId);
                    return (
                      <li key={fieldId}>
                        {info ? `${info.block} · ${info.label}` : fieldId}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <textarea
              className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Parecer técnico (obrigatório para solicitar ajustes ou aprovar)."
              disabled={!isReviewer || !inPreSalesQueue}
            />

            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void executeAction("REQUEST_CHANGES")}
                disabled={!isReviewer || saving || !comment.trim() || !inPreSalesQueue || requestedFieldIds.length === 0}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
              >
                Solicitar ajustes
              </button>
              <button
                type="button"
                onClick={() => void executeAction("APPROVE_TECHNICAL")}
                disabled={
                  !isReviewer ||
                  saving ||
                  !comment.trim() ||
                  !inPreSalesQueue ||
                  !isChecklistComplete(checklist) ||
                  cannotApproveTechnical
                }
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Aprovar parecer técnico
              </button>
            </div>
            <p className="mt-1 text-[10px] text-surface-500">
              No formulário acima, use o ▲ amarelo ao lado do campo para marcar/desmarcar item solicitado para revisão.
            </p>
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
