"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppCard } from "@/components/AppCard";
import { AppShell } from "@/components/AppShell";
import {
  type PreSalesBlockComments,
  defaultPreSalesChecklist,
  parsePreSalesMeta,
  type PreSalesChecklist,
  type PreSalesStage,
} from "@/lib/preSalesMeta";
import { preSalesValidationMap } from "@/lib/preSalesValidationMap";
import { etapaPreVendasPt, statusPropostaPt } from "@/lib/uiLabels";

type SessionPayload = {
  id: string;
  title: string;
  status: string;
  revision: number;
  payloadJson: string;
  clientName?: string | null;
  opportunityRef?: string | null;
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

function valueText(v: string | undefined) {
  if (!v || !String(v).trim()) return "—";
  return v;
}

function hasComment(text: string | undefined) {
  return Boolean(text && text.trim().length > 0);
}

export default function PreVendasValidacaoPorIdPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<PreSalesStage>("DRAFTING");
  const [checklist, setChecklist] = useState<PreSalesChecklist>({ ...defaultPreSalesChecklist });
  const [blockComments, setBlockComments] = useState<PreSalesBlockComments>({});
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    const [meRes, formRes] = await Promise.all([fetch("/api/auth/me"), fetch(`/api/forms/${id}`)]);
    if (meRes.ok) {
      const me = (await meRes.json()) as { user: { role: string } };
      setUserRole(me.user.role);
    }
    if (!formRes.ok) {
      setError("Falha ao carregar proposta para validação.");
      setLoading(false);
      return;
    }
    const body = (await formRes.json()) as { session: SessionPayload };
    setSession(body.session);
    const p = JSON.parse(body.session.payloadJson || "{}") as Record<string, string>;
    setPayload(p);
    const meta = parsePreSalesMeta(p);
    setStage(meta.stage);
    setChecklist({ ...meta.checklist });
    setBlockComments({ ...meta.blockComments });
    setComment(meta.lastComment ?? "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isReviewer = userRole === "PRE_VENDAS" || userRole === "ADMIN";

  const evidence = useMemo(
    () =>
      (Object.keys(checklistLabels) as Array<keyof PreSalesChecklist>).map((k) => {
        const groups = preSalesValidationMap[k];
        const missing = groups.flatMap((g) =>
          g.fields.filter((f) => !String(payload[f.id] ?? "").trim()).map((f) => `${g.block} · ${f.label}`),
        );
        return { key: k, groups, missing };
      }),
    [payload],
  );

  const hasMissingEvidence = evidence.some((e) => e.missing.length > 0);

  const blockCommentKey = (checkKey: keyof PreSalesChecklist, block: string) => `${checkKey}::${block}`;
  const totalBlockCount = evidence.reduce((acc, item) => acc + item.groups.length, 0);
  const commentedBlockCount = evidence.reduce(
    (acc, item) =>
      acc +
      item.groups.filter((g) => hasComment(blockComments[blockCommentKey(item.key, g.block)])).length,
    0,
  );
  const pendingBlockCount = totalBlockCount - commentedBlockCount;

  const saveBlockComments = async () => {
    if (!session || !isReviewer) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/forms/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: session.revision,
        preSalesChecklist: checklist,
        preSalesBlockComments: blockComments,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao salvar comentarios dos blocos.");
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
        preSalesBlockComments: blockComments,
        preSalesComment: comment,
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
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-surface-900">Pré-vendas</h1>
          <p className="mt-0.5 text-[11px] text-surface-500">
            Workspace do pré-vendas: evidências por bloco, checklist obrigatório e decisão técnica.
          </p>
        </div>
        <Link
          href={`/propostas/${encodeURIComponent(id)}`}
          className="rounded-md border border-surface-200 bg-surface-0 px-2 py-1 text-[11px] font-medium text-surface-700 hover:bg-surface-50"
        >
          Ver formulário completo
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-surface-500">Carregando fila do pré-vendas...</p>
      ) : !session ? (
        <p className="text-sm text-surface-500">Proposta não encontrada.</p>
      ) : (
        <div className="space-y-2">

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}

          <AppCard>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-1.5">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-surface-900">{session.title}</h2>
                <p className="truncate text-[11px] text-surface-500">
                  {session.id} · Rev. {session.revision} · {statusPropostaPt(session.status)} · {etapaPreVendasPt(stage)}
                </p>
              </div>
              <div className="text-[11px] text-surface-600">{session.createdBy?.name ?? "—"}</div>
            </div>
            <div className="mb-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => void saveBlockComments()}
                disabled={!isReviewer || saving}
                className="rounded-md border border-surface-300 bg-surface-0 px-2.5 py-1 text-[11px] font-medium text-surface-800 disabled:opacity-50"
              >
                Salvar comentários dos blocos
              </button>
            </div>
            <div className="mb-1.5 grid gap-1 sm:grid-cols-3">
              <div className="rounded-md border border-surface-200 bg-surface-0 px-2.5 py-1.5">
                <p className="text-[11px] uppercase tracking-wide text-surface-500">Blocos mapeados</p>
                <p className="text-sm font-semibold text-surface-900">{totalBlockCount}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">Comentados</p>
                <p className="text-sm font-semibold text-emerald-800">{commentedBlockCount}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                <p className="text-[11px] uppercase tracking-wide text-amber-700">Pendentes</p>
                <p className="text-sm font-semibold text-amber-800">{pendingBlockCount}</p>
              </div>
            </div>
            <div className="space-y-2">
              {evidence.map((item) => (
                <div key={item.key} className="rounded-lg border border-surface-200/80 bg-surface-50/50 p-2">
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium text-surface-800">
                    <input
                      type="checkbox"
                      checked={checklist[item.key]}
                      disabled={!isReviewer}
                      onChange={(e) =>
                        setChecklist((old) => ({
                          ...old,
                          [item.key]: e.target.checked,
                        }))
                      }
                    />
                    {checklistLabels[item.key]}
                  </label>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    {item.groups.map((g) => (
                      <div key={`${item.key}-${g.block}`} className="rounded border border-surface-200 bg-surface-0 p-1.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">{g.block}</p>
                          {hasComment(blockComments[blockCommentKey(item.key, g.block)]) ? (
                            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Comentado
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Sem comentário
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1 text-xs text-surface-700">
                          {g.fields.map((f) => (
                            <li key={f.id} className="flex items-start justify-between gap-2">
                              <span>{f.label}</span>
                              <span className="max-w-[60%] truncate text-surface-500" title={valueText(payload[f.id])}>
                                {valueText(payload[f.id])}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <textarea
                          className="mt-1.5 w-full rounded-md border border-surface-200 px-2 py-1 text-xs text-surface-800"
                          rows={2}
                          placeholder="Comentário técnico deste bloco"
                          disabled={!isReviewer}
                          value={blockComments[blockCommentKey(item.key, g.block)] ?? ""}
                          onChange={(e) =>
                            setBlockComments((old) => ({
                              ...old,
                              [blockCommentKey(item.key, g.block)]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {item.missing.length > 0 ? (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Evidências pendentes: {item.missing.length}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-emerald-700">Evidências completas.</p>
                  )}
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard>
            <h3 className="text-sm font-semibold text-surface-900">Parecer técnico</h3>
            <textarea
              className="mt-1.5 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Registre parecer técnico objetivo (obrigatório para aprovar ou solicitar ajustes)."
              disabled={!isReviewer}
            />
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void executeAction("REQUEST_CHANGES")}
                disabled={!isReviewer || saving || !comment.trim()}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
              >
                Solicitar ajustes
              </button>
              <button
                type="button"
                onClick={() => void executeAction("APPROVE_TECHNICAL")}
                disabled={!isReviewer || saving || !comment.trim() || hasMissingEvidence}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Aprovar parecer técnico
              </button>
            </div>
            {hasMissingEvidence ? (
              <p className="mt-2 text-[11px] text-amber-800">
                Não é possível aprovar enquanto houver evidências pendentes nos blocos acima.
              </p>
            ) : null}
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
