"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AppCard } from "@/components/AppCard";
import { PageHeader } from "@/components/PageHeader";
import { statusPropostaPt } from "@/lib/uiLabels";

type SessionRow = {
  id: string;
  title: string;
  status: "DRAFT" | "IN_PROGRESS" | "PAUSED" | "FINALIZED" | "ARCHIVED";
  updatedAt: string;
  clientName?: string | null;
  opportunityRef?: string | null;
  revision?: number;
  createdBy?: { name: string; email: string };
};

type QueueFilter = "ALL" | "ACTIVE" | "PAUSED" | "CLOSED";
type QueuePriority = "ALTA" | "MEDIA" | "BAIXA";

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

function queuePriority(status: SessionRow["status"], updatedAt: string): QueuePriority {
  const mins = minutesSince(updatedAt);
  if (status === "IN_PROGRESS" && mins > 60 * 24) return "ALTA";
  if (status === "PAUSED" && mins > 60 * 24 * 2) return "ALTA";
  if (mins > 60 * 8) return "MEDIA";
  return "BAIXA";
}

function priorityClass(priority: QueuePriority) {
  if (priority === "ALTA") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "MEDIA") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function statusGroup(status: SessionRow["status"]): QueueFilter {
  if (status === "IN_PROGRESS") return "ACTIVE";
  if (status === "PAUSED" || status === "DRAFT") return "PAUSED";
  return "CLOSED";
}

function ProposalTable({ rows, userRole }: { rows: SessionRow[]; userRole: string | undefined }) {
  const router = useRouter();

  const open = (id: string) => {
    router.push(`/propostas/${encodeURIComponent(id)}`);
  };

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
            <th className="px-3 py-2">Cliente</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Rev.</th>
            <th className="px-3 py-2">Atualizado</th>
            <th className="px-3 py-2">Tempo fila</th>
            {userRole !== "COMERCIAL" ? <th className="px-3 py-2">Responsável</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100/90">
          {rows.map((s) => (
            <tr
              key={s.id}
              role="link"
              tabIndex={0}
              className="group cursor-pointer text-surface-800 transition hover:bg-brand-500/8"
              onClick={() => open(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(s.id);
                }
              }}
              aria-label={`Abrir proposta: ${s.title}`}
            >
              <td className="px-3 py-2.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClass(queuePriority(s.status, s.updatedAt))}`}
                >
                  {queuePriority(s.status, s.updatedAt)}
                </span>
              </td>
              <td className="max-w-[280px] px-3 py-2.5">
                <p className="truncate text-sm font-medium text-surface-900">{s.title}</p>
                <p className="truncate font-mono text-[10px] text-brand-700">{s.id.toUpperCase()}</p>
              </td>
              <td className="max-w-[180px] truncate px-3 py-2.5 text-sm text-surface-700">
                {s.clientName ?? "—"}
              </td>
              <td className="px-3 py-2.5 text-xs text-surface-600">{statusPropostaPt(s.status)}</td>
              <td className="px-3 py-2.5 tabular-nums text-surface-600">{s.revision ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-surface-500">
                {new Date(s.updatedAt).toLocaleString("pt-BR")}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-surface-700">{agingLabel(s.updatedAt)}</td>
              {userRole !== "COMERCIAL" ? (
                <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-surface-500">
                  {s.createdBy?.name ?? "—"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PropostasPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queue = params.get("queue");
    if (queue === "ALL" || queue === "ACTIVE" || queue === "PAUSED" || queue === "CLOSED") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueueFilter(queue);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const me = (await meRes.json()) as { user: { role: string } };
        setUserRole(me.user.role);
      }
      const formsRes = await fetch("/api/forms");
      if (formsRes.ok) {
        const payload = (await formsRes.json()) as { sessions: SessionRow[] };
        setSessions(payload.sessions);
      }
      setLoading(false);
    })();
  }, []);

  const filteredSessions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sessions
      .filter((s) => (queueFilter === "ALL" ? true : statusGroup(s.status) === queueFilter))
      .filter((s) => (ownerFilter === "ALL" ? true : (s.createdBy?.name ?? "—") === ownerFilter))
      .filter((s) => {
        if (!term) return true;
        const haystack = [s.id, s.title, s.clientName ?? "", s.createdBy?.name ?? "", s.opportunityRef ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions, query, queueFilter, ownerFilter]);

  const owners = useMemo(() => {
    return Array.from(new Set(sessions.map((s) => s.createdBy?.name ?? "—"))).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const counters = useMemo(() => {
    return {
      all: sessions.length,
      active: sessions.filter((s) => statusGroup(s.status) === "ACTIVE").length,
      paused: sessions.filter((s) => statusGroup(s.status) === "PAUSED").length,
      closed: sessions.filter((s) => statusGroup(s.status) === "CLOSED").length,
    };
  }, [sessions]);

  return (
    <AppShell active="propostas">
      <PageHeader
        title="Fila de propostas"
        description="Operação da fila: filtre, priorize e abra a proposta em um clique."
        action={
          <Link
            href="/propostas/nova"
            className="rounded-lg bg-surface-900 px-3 py-2 text-xs font-semibold text-white hover:bg-surface-800"
          >
            Nova proposta
          </Link>
        }
      />

      {loading ? (
        <p className="text-sm text-surface-500">Carregando a fila...</p>
      ) : (
        <div className="space-y-3">
          <AppCard className="overflow-hidden" padding="p-0">
            <div className="border-b border-surface-200 bg-surface-50/70 px-3 py-2">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por ID, título, cliente, responsável ou oportunidade"
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                />
                <select
                  value={queueFilter}
                  onChange={(e) => setQueueFilter(e.target.value as QueueFilter)}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                >
                  <option value="ALL">Todas ({counters.all})</option>
                  <option value="ACTIVE">Em andamento ({counters.active})</option>
                  <option value="PAUSED">Pausadas/rascunho ({counters.paused})</option>
                  <option value="CLOSED">Encerradas ({counters.closed})</option>
                </select>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-700"
                >
                  <option value="ALL">Todos responsáveis</option>
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setQueueFilter("ALL");
                    setOwnerFilter("ALL");
                  }}
                  className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs font-medium text-surface-700 hover:bg-surface-50"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
            <div className="border-b border-surface-100 px-3 py-2 text-xs text-surface-500">
              {filteredSessions.length} proposta(s) na fila exibida
            </div>
            <div className="p-1 sm:p-2">
              <ProposalTable rows={filteredSessions} userRole={userRole} />
            </div>
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
