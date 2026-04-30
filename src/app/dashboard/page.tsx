"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { btnAccent } from "@/lib/uiClasses";

type Metrics = {
  kpis: {
    totalRecebidas: number;
    emAndamento: number;
    documentosGerados: number;
    urgentes: number;
    taxaConversao: number;
    preSalesInReview: number;
    preSalesChangesRequested: number;
    preSalesApproved: number;
    preSalesApprovalRate: number;
    preSalesSlaHours: number;
    preSalesSlaP90: number;
    preSalesSubmitted: number;
    preSalesDecisionsLast30: number;
    averageOpenAgeHours: number;
    staleOver7d: number;
    pausadas: number;
    finalizadas: number;
    arquivadas: number;
  };
  monthly: Array<{ month: string; total: number; documents: number; decisions: number }>;
  stageDistribution: Array<{ stage: string; value: number }>;
  statusDistribution: Array<{ status: string; value: number }>;
  userActivity: Array<{
    userId: string;
    userName: string;
    totalActivities: number;
    edits: number;
    preSalesSubmissions: number;
    preSalesApprovals: number;
    preSalesChangesRequested: number;
  }>;
  advanced: {
    firstActionHoursAvg: number;
    leadTimeHoursAvg: number;
    sessionsWithoutUpdate48h: number;
    multiReworkCount: number;
    trendEntradasPct: number;
    trendDocsPct: number;
    backlogByOwner: Array<{ owner: string; value: number }>;
    topIssueBlocks: Array<{ blockId: string; value: number }>;
  };
};

function KpiCard({
  title,
  value,
  accent,
  iconTone,
  href,
}: {
  title: string;
  value: string | number;
  accent: string;
  iconTone: string;
  href?: string;
}) {
  const card = (
    <div
      className={`h-[58px] rounded-[14px] border border-surface-200 bg-surface-0 px-3 py-2 shadow-[0_1px_2px_rgb(26_29_46_/_0.06),0_1px_1px_rgb(26_29_46_/_0.04)] border-l-[3px] ${accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[8px] font-medium uppercase tracking-[0.12em] text-surface-500">{title}</p>
        <span className={`mt-0.5 inline-flex h-3.5 w-3.5 rounded-md border ${iconTone}`} />
      </div>
      <p className="mt-0.5 truncate text-[20px] font-semibold leading-none tracking-[-0.01em] text-surface-900">
        {value}
      </p>
    </div>
  );

  if (!href) return card;

  return (
    <Link href={href} className="block transition hover:opacity-95" aria-label={`Abrir detalhe de ${title}`}>
      {card}
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-0 p-3 shadow-sm">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
        {subtitle ? <p className="text-[11px] text-surface-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [period, setPeriod] = useState<"7" | "30" | "90" | "365">("30");

  useEffect(() => {
    void (async () => {
      const [meRes, mtRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/dashboard/metrics?periodDays=${period}`),
      ]);
      if (meRes.ok) {
        const me = (await meRes.json()) as { user: { role: string } };
        setUserRole(me.user.role);
      }
      if (mtRes.ok) setMetrics((await mtRes.json()) as Metrics);
      setLoading(false);
    })();
  }, [period]);

  const maxMonthly = useMemo(
    () => Math.max(...(metrics?.monthly.map((m) => Math.max(m.total, m.documents, m.decisions)) ?? [1]), 1),
    [metrics],
  );
  const totalStatus = useMemo(
    () => (metrics?.statusDistribution.reduce((acc, cur) => acc + cur.value, 0) ?? 1),
    [metrics],
  );
  const totalActivities = useMemo(
    () => (metrics?.userActivity.reduce((acc, cur) => acc + cur.totalActivities, 0) ?? 1),
    [metrics],
  );
  const propostasAtivas = useMemo(
    () =>
      (metrics?.kpis.emAndamento ?? 0) +
      (metrics?.kpis.preSalesInReview ?? 0) +
      (metrics?.kpis.preSalesChangesRequested ?? 0),
    [metrics],
  );

  return (
    <AppShell active="dashboard">
      <PageHeader
        title="Dashboard"
        description="Visão geral de solicitações e orçamentos"
        action={
          <div className="flex items-center gap-1.5">
            {[
              { id: "7" as const, label: "7 dias" },
              { id: "30" as const, label: "30 dias" },
              { id: "90" as const, label: "90 dias" },
              { id: "365" as const, label: "1 ano" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={
                  period === p.id
                    ? "rounded-md border border-brand-500/55 bg-surface-0 px-2 py-1 text-[11px] font-semibold text-surface-900 shadow-sm shadow-brand-500/12"
                    : "rounded-md border border-surface-200 bg-surface-50 px-2 py-1 text-[11px] text-surface-600 hover:bg-surface-0"
                }
              >
                {p.label}
              </button>
            ))}
            {userRole && userRole !== "LEITURA" ? (
              <Link href="/propostas/nova" className={btnAccent}>
                + Nova solicitação
              </Link>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-surface-500">Carregando indicadores...</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">Visão executiva</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="Entradas no período" value={metrics?.kpis.totalRecebidas ?? 0} accent="border-l-brand-500" iconTone="border-brand-300 bg-brand-50" href="/propostas?queue=ALL" />
              <KpiCard title="Propostas ativas" value={propostasAtivas} accent="border-l-violet-500" iconTone="border-violet-300 bg-violet-50" href="/propostas?queue=ACTIVE" />
              <KpiCard title="Na fila pré-vendas" value={metrics?.kpis.preSalesInReview ?? 0} accent="border-l-blue-500" iconTone="border-blue-300 bg-blue-50" href="/pre-vendas/validacoes?stage=UNDER_PRE_SALES_REVIEW" />
              <KpiCard title="Aguardando ajustes" value={metrics?.kpis.preSalesChangesRequested ?? 0} accent="border-l-amber-500" iconTone="border-amber-300 bg-amber-50" href="/pre-vendas/validacoes?stage=CHANGES_REQUESTED" />
              <KpiCard title="Aprovação técnica" value={`${metrics?.kpis.preSalesApprovalRate ?? 0}%`} accent="border-l-teal-500" iconTone="border-teal-300 bg-teal-50" href="/pre-vendas/validacoes?stage=APPROVED_PRE_SALES" />
              <KpiCard title="Conversão orçamento" value={`${metrics?.kpis.taxaConversao ?? 0}%`} accent="border-l-emerald-500" iconTone="border-emerald-300 bg-emerald-50" href="/submissoes" />
              <KpiCard title="SLA médio decisão" value={`${metrics?.kpis.preSalesSlaHours ?? 0}h`} accent="border-l-fuchsia-500" iconTone="border-fuchsia-300 bg-fuchsia-50" href="/pre-vendas/validacoes?stage=UNDER_PRE_SALES_REVIEW" />
              <KpiCard title="Fila urgente > 48h" value={metrics?.kpis.urgentes ?? 0} accent="border-l-rose-500" iconTone="border-rose-300 bg-rose-50" href="/pre-vendas/validacoes?priority=ALTA" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
            <Panel title="Entradas x Entregas" subtitle="Entradas, orçamentos e decisões no período">
              <div className="flex h-44 items-end justify-center gap-2">
                {(metrics?.monthly ?? []).map((item) => (
                  <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex w-full max-w-[2rem] items-end gap-0.5">
                      <div
                        className="w-2 rounded-t bg-brand-500"
                        style={{ height: `${Math.max((item.total / maxMonthly) * 110, 6)}px` }}
                      />
                      <div
                        className="w-2 rounded-t bg-cyan-500"
                        style={{ height: `${Math.max((item.documents / maxMonthly) * 110, 6)}px` }}
                      />
                      <div
                        className="w-2 rounded-t bg-emerald-500"
                        style={{ height: `${Math.max((item.decisions / maxMonthly) * 110, 6)}px` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-surface-500">{item.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Resumo do Período" subtitle="Leitura direta da operação">
              <div className="flex h-44 items-center justify-center">
                <div className="w-full space-y-2 text-[12px]">
                  <div className="flex items-center justify-between rounded-md bg-surface-50 px-2 py-1">
                    <span>Submissões para pré-vendas</span>
                    <strong>{metrics?.kpis.preSalesSubmitted ?? 0}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-surface-50 px-2 py-1">
                    <span>Decisões técnicas</span>
                    <strong>{metrics?.kpis.preSalesDecisionsLast30 ?? 0}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-surface-50 px-2 py-1">
                    <span>Conversão para orçamento</span>
                    <strong>{metrics?.kpis.taxaConversao ?? 0}%</strong>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Etapas do Pré-vendas" subtitle="Onde estão as propostas no fluxo técnico">
              <div className="space-y-2">
                {(metrics?.stageDistribution ?? []).map((item) => {
                  const totalStage = (metrics?.stageDistribution ?? []).reduce((acc, cur) => acc + cur.value, 0);
                  const pct = totalStage === 0 ? 0 : Math.round((item.value / totalStage) * 100);
                  return (
                    <div key={`stage-${item.stage}`}>
                      <div className="mb-1 flex justify-between text-[11px] text-surface-600">
                        <span>{item.stage}</span>
                        <span className="font-medium">
                          {item.value} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-100">
                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <Panel title="Estados Operacionais" subtitle={`${totalStatus} itens monitorados`}>
              <div className="space-y-2">
                {(metrics?.statusDistribution ?? []).map((item) => {
                  const pct = totalStatus === 0 ? 0 : Math.round((item.value / totalStatus) * 100);
                  return (
                    <div key={`status-${item.status}`}>
                      <div className="mb-1 flex justify-between text-[11px] text-surface-600">
                        <span>{item.status}</span>
                        <span className="font-medium">
                          {item.value} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Atividades por usuário" subtitle={`${totalActivities} atividades no período`}>
              <div className="space-y-2">
                {(metrics?.userActivity ?? []).map((item) => {
                  const pct = totalActivities === 0 ? 0 : Math.round((item.totalActivities / totalActivities) * 100);
                  return (
                    <div key={`users-activity-${item.userId}`}>
                      <div className="mb-1 flex justify-between text-[11px] text-surface-600">
                        <span className="truncate pr-2">{item.userName}</span>
                        <span className="font-medium">
                          {item.totalActivities} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-100">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <Panel title="Detalhe de atividades por usuário" subtitle="Edições, envios, aprovações e ajustes">
              <div className="space-y-1.5">
                {(metrics?.userActivity ?? []).map((item) => {
                  return (
                    <div key={`users-detail-${item.userId}`} className="rounded-md border border-surface-200 px-2 py-1.5">
                      <div className="mb-1 flex justify-between text-[11px] text-surface-600">
                        <span className="truncate pr-2">{item.userName}</span>
                        <span className="font-medium">{item.totalActivities}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-surface-500">
                        <span>Edições: {item.edits}</span>
                        <span>Envios PV: {item.preSalesSubmissions}</span>
                        <span>Aprovações: {item.preSalesApprovals}</span>
                        <span>Ajustes: {item.preSalesChangesRequested}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Indicadores Avançados" subtitle="Sinais de eficiência sem poluir o painel">
              <div className="overflow-hidden rounded-md border border-surface-200">
                <div className="flex items-center justify-between border-b border-surface-200 px-2 py-1.5 text-[12px]">
                  <span>1ª ação média</span>
                  <strong>{metrics?.advanced.firstActionHoursAvg ?? 0}h</strong>
                </div>
                <div className="flex items-center justify-between border-b border-surface-200 px-2 py-1.5 text-[12px]">
                  <span>Lead time médio</span>
                  <strong>{metrics?.advanced.leadTimeHoursAvg ?? 0}h</strong>
                </div>
                <div className="flex items-center justify-between border-b border-surface-200 px-2 py-1.5 text-[12px]">
                  <span>Sem atualização 48h</span>
                  <strong>{metrics?.advanced.sessionsWithoutUpdate48h ?? 0}</strong>
                </div>
                <div className="flex items-center justify-between border-b border-surface-200 px-2 py-1.5 text-[12px]">
                  <span>Retrabalho &gt; 1 ciclo</span>
                  <strong>{metrics?.advanced.multiReworkCount ?? 0}</strong>
                </div>
                <div className="flex items-center justify-between border-b border-surface-200 px-2 py-1.5 text-[12px]">
                  <span>Tendência entradas</span>
                  <strong>{metrics?.advanced.trendEntradasPct ?? 0}%</strong>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 text-[12px]">
                  <span>Tendência orçamentos</span>
                  <strong>{metrics?.advanced.trendDocsPct ?? 0}%</strong>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
