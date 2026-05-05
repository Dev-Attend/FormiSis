"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/AppCard";
import { AppShell } from "@/components/AppShell";
import { etapaPreVendasPt } from "@/lib/uiLabels";

type SessionRow = {
  id: string;
  title: string;
  status: string;
  revision: number;
  updatedAt: string;
  createdBy?: { name: string; email: string };
  payloadJson: string;
};

type Stage = "DRAFTING" | "UNDER_PRE_SALES_REVIEW" | "CHANGES_REQUESTED" | "APPROVED_PRE_SALES";
type QueuePriority = "ALTA" | "MEDIA" | "BAIXA";

function stageFromPayload(payloadJson: string): Stage {
  try {
    const payload = JSON.parse(payloadJson || "{}") as Record<string, string>;
    const raw = payload.__preSalesMeta;
    if (!raw) return "DRAFTING";
    const parsed = JSON.parse(raw) as { stage?: Stage };
    return parsed.stage ?? "DRAFTING";
  } catch {
    return "DRAFTING";
  }
}

function minutesSince(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

function agingLabel(dateIso: string) {
  const m = minutesSince(dateIso);
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) return `${Math.floor(m / 60)} h`;
  return `${Math.floor(m / (60 * 24))} d`;
}

function queuePriority(stage: Stage, updatedAt: string): QueuePriority {
  const mins = minutesSince(updatedAt);
  if ((stage === "UNDER_PRE_SALES_REVIEW" || stage === "CHANGES_REQUESTED") && mins > 60 * 24) return "ALTA";
  if (mins > 60 * 8) return "MEDIA";
  return "BAIXA";
}

function priorityClass(priority: QueuePriority) {
  if (priority === "ALTA") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "MEDIA") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function ValidationTable({ rows }: { rows: Array<SessionRow & { preSalesStage: Stage }> }) {
  const router = useRouter();
  const open = (id: string) => router.push(`/pre-vendas/validacoes/${encodeURIComponent(id)}`);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-surface-500">Nenhuma proposta encontrada para os filtros atuais.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-surface-0">
          <tr className="border-b border-surface-200 text-[11px] font-medium uppercase tracking-wide text-surface-500">
            <th className="px-3 py-2">Prioridade</th>
            <th className="px-3 py-2">Proposta</th>
            <th className="px-3 py-2">Etapa</th>
            <th className="px-3 py-2">Rev.</th>
            <th className="px-3 py-2">Comercial</th>
            <th className="px-3 py-2">Atualizada</th>
            <th className="px-3 py-2">Tempo fila</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100">
          {rows.map((r) => (
            <tr
              key={r.id}
              role="link"
              tabIndex={0}
              className="cursor-pointer text-surface-800 transition hover:bg-brand-500/8"
              onClick={() => open(r.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(r.id);
                }
              }}
              aria-label={`Abrir validação: ${r.title}`}
            >
              <td className="px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClass(queuePriority(r.preSalesStage, r.updatedAt))}`}
                >
                  {queuePriority(r.preSalesStage, r.updatedAt)}
                </span>
              </td>
              <td className="max-w-[280px] px-3 py-2.5">
                <div className="truncate font-medium">{r.title}</div>
                <div className="truncate font-mono text-[10px] text-surface-500">{r.id}</div>
              </td>
              <td className="px-3 py-2.5 text-xs text-surface-600">{etapaPreVendasPt(r.preSalesStage)}</td>
              <td className="px-3 py-2.5 text-surface-600">{r.revision}</td>
              <td className="max-w-[150px] truncate px-3 py-2.5 text-surface-600">{r.createdBy?.name ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-surface-500">
                {new Date(r.updatedAt).toLocaleString("pt-BR")}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-surface-700">{agingLabel(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ValidacoesPreVendasPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<QueuePriority | "ALL">("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stage = params.get("stage");
    if (
      stage === "ALL" ||
      stage === "DRAFTING" ||
      stage === "UNDER_PRE_SALES_REVIEW" ||
      stage === "CHANGES_REQUESTED" ||
      stage === "APPROVED_PRE_SALES"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStageFilter(stage);
    }
    const priority = params.get("priority");
    if (priority === "ALL" || priority === "ALTA" || priority === "MEDIA" || priority === "BAIXA") {
      setPriorityFilter(priority);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const me = (await meRes.json()) as { user: { role: string } };
        setRole(me.user.role);
      }
      const res = await fetch("/api/forms");
      if (res.ok) {
        const payload = (await res.json()) as { sessions: SessionRow[] };
        setSessions(payload.sessions);
      }
      setLoading(false);
    })();
  }, []);

  const withStage = useMemo(
    () => sessions.map((s) => ({ ...s, preSalesStage: stageFromPayload(s.payloadJson) })),
    [sessions],
  );

  const owners = useMemo(
    () => Array.from(new Set(withStage.map((s) => s.createdBy?.name ?? "—"))).sort((a, b) => a.localeCompare(b)),
    [withStage],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return withStage
      .filter((s) => (stageFilter === "ALL" ? true : s.preSalesStage === stageFilter))
      .filter((s) =>
        priorityFilter === "ALL" ? true : queuePriority(s.preSalesStage, s.updatedAt) === priorityFilter,
      )
      .filter((s) => (ownerFilter === "ALL" ? true : (s.createdBy?.name ?? "—") === ownerFilter))
      .filter((s) => {
        if (!term) return true;
        const haystack = [s.id, s.title, s.createdBy?.name ?? ""].join(" ").toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [withStage, query, stageFilter, priorityFilter, ownerFilter]);

  const counters = useMemo(
    () => ({
      review: withStage.filter((s) => s.preSalesStage === "UNDER_PRE_SALES_REVIEW").length,
      changes: withStage.filter((s) => s.preSalesStage === "CHANGES_REQUESTED").length,
      approved: withStage.filter((s) => s.preSalesStage === "APPROVED_PRE_SALES").length,
    }),
    [withStage],
  );

  return (
    <AppShell active="validacoes">
      <div className="mb-1">
        <h1 className="text-sm font-semibold text-surface-900">Pré-vendas</h1>
        <p className="mt-0.5 text-[11px] text-surface-500">Operação da fila técnica: filtre, priorize e execute os pareceres.</p>
      </div>

      {loading ? (
        <p className="text-sm text-surface-500">Carregando fila do pré-vendas...</p>
      ) : role !== "PRE_VENDAS" && role !== "ADMIN" ? (
        <AppCard>
          <p className="text-sm text-surface-700">
            Esta área é exclusiva de Pré-vendas e Administração.
          </p>
        </AppCard>
      ) : (
        <div className="space-y-3">
          <AppCard className="overflow-hidden" padding="p-0">
            <div className="border-b border-surface-200 bg-surface-50/70 px-3 py-2">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por ID, título ou comercial"
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                />
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as Stage | "ALL")}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                >
                  <option value="ALL">Todas as etapas</option>
                  <option value="UNDER_PRE_SALES_REVIEW">
                    {etapaPreVendasPt("UNDER_PRE_SALES_REVIEW")} ({counters.review})
                  </option>
                  <option value="CHANGES_REQUESTED">
                    {etapaPreVendasPt("CHANGES_REQUESTED")} ({counters.changes})
                  </option>
                  <option value="APPROVED_PRE_SALES">
                    {etapaPreVendasPt("APPROVED_PRE_SALES")} ({counters.approved})
                  </option>
                </select>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                >
                  <option value="ALL">Todos os comerciais</option>
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as QueuePriority | "ALL")}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                >
                  <option value="ALL">Todas prioridades</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStageFilter("ALL");
                    setPriorityFilter("ALL");
                    setOwnerFilter("ALL");
                  }}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
            <div className="border-b border-surface-100 px-3 py-2 text-xs text-surface-500">
              {filtered.length} proposta(s) na fila exibida
            </div>
            <div className="p-1 sm:p-2">
              <ValidationTable rows={filtered} />
            </div>
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
