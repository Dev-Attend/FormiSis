import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAccess } from "@/lib/auth";
import { parsePreSalesMeta } from "@/lib/preSalesMeta";

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function hoursBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAccess(request, [
    "ADMIN",
    "COMERCIAL",
    "PRE_VENDAS",
    "LEITURA",
  ]);
  if (!auth.ok) return auth.response;

  const restrictToOwner = auth.user.role === "COMERCIAL";
  const periodDaysRaw = Number(request.nextUrl.searchParams.get("periodDays") ?? 30);
  const periodDays = [7, 30, 90, 365].includes(periodDaysRaw) ? periodDaysRaw : 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [sessions, submissions, audits] = await Promise.all([
    db.formSession.findMany({
      where: restrictToOwner ? { createdById: auth.user.id } : {},
      select: {
        id: true,
        status: true,
        startedAt: true,
        updatedAt: true,
        finalizedAt: true,
        payloadJson: true,
        createdById: true,
        createdBy: { select: { name: true, email: true } },
      },
    }),
    db.submission.findMany({
      where: restrictToOwner ? { createdById: auth.user.id } : {},
      select: { generatedAt: true },
      orderBy: { generatedAt: "desc" },
      take: 5000,
    }),
    db.auditLog.findMany({
      where: {
        createdAt: { gte: periodStart },
        ...(restrictToOwner ? { userId: auth.user.id } : {}),
      },
      select: {
        action: true,
        createdAt: true,
        userId: true,
        formSessionId: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 20000,
    }),
  ]);

  const typedSubmissions = submissions as Array<{ generatedAt: Date }>;
  const typedSessions = sessions as Array<{
    id: string;
    status: string;
    startedAt: Date;
    updatedAt: Date;
    finalizedAt?: Date | null;
    payloadJson: string;
    createdById: string;
    createdBy?: { name?: string | null; email?: string | null } | null;
  }>;
  const typedAudits = audits as Array<{
    action: string;
    createdAt: Date;
    userId: string;
    formSessionId?: string | null;
    user: { name: string; email: string } | null;
  }>;
  const sessionsInPeriod = typedSessions.filter((s) => s.startedAt >= periodStart);
  const submissionsInPeriod = typedSubmissions.filter((s) => s.generatedAt >= periodStart);

  const monthlyCreated = new Map<string, number>();
  const monthlyDocs = new Map<string, number>();
  const monthlyDecisions = new Map<string, number>();
  sessionsInPeriod.forEach((s) => {
    const key = toMonthKey(s.startedAt);
    monthlyCreated.set(key, (monthlyCreated.get(key) ?? 0) + 1);
  });
  submissionsInPeriod.forEach((s) => {
    const key = toMonthKey(s.generatedAt);
    monthlyDocs.set(key, (monthlyDocs.get(key) ?? 0) + 1);
  });
  typedAudits.forEach((a) => {
    if (
      (a.action === "PRE_SALES_APPROVE_TECHNICAL" || a.action === "PRE_SALES_REQUEST_CHANGES") &&
      a.createdAt >= periodStart
    ) {
      const key = toMonthKey(a.createdAt);
      monthlyDecisions.set(key, (monthlyDecisions.get(key) ?? 0) + 1);
    }
  });

  const monthKeys = Array.from(new Set([...monthlyCreated.keys(), ...monthlyDocs.keys(), ...monthlyDecisions.keys()]))
    .sort((a, b) => a.localeCompare(b))
    .slice(-6);
  const monthly = monthKeys.map((month) => ({
    month,
    total: monthlyCreated.get(month) ?? 0,
    documents: monthlyDocs.get(month) ?? 0,
    decisions: monthlyDecisions.get(month) ?? 0,
  }));

  const stageAgg = typedSessions.reduce(
    (acc, session) => {
      let payload: Record<string, string> = {};
      try {
        payload = JSON.parse(session.payloadJson || "{}") as Record<string, string>;
      } catch {
        payload = {};
      }

      const meta = parsePreSalesMeta(payload);
      if (meta.stage === "UNDER_PRE_SALES_REVIEW") acc.underPreSalesReview += 1;
      if (meta.stage === "CHANGES_REQUESTED") acc.changesRequested += 1;
      if (meta.stage === "APPROVED_PRE_SALES") acc.approvedPreSales += 1;
      if (meta.stage === "DRAFTING") acc.drafting += 1;

      const submittedAt = meta.submittedAt ? new Date(meta.submittedAt) : null;
      const decisionAt = meta.lastDecisionAt ? new Date(meta.lastDecisionAt) : null;

      if (submittedAt && decisionAt && decisionAt.getTime() >= submittedAt.getTime()) {
        const decisionHours = hoursBetween(submittedAt, decisionAt);
        acc.totalDecisionHours += decisionHours;
        acc.decisionSamples.push(decisionHours);
        acc.decisionsWithSla += 1;
      }

      if (meta.stage === "UNDER_PRE_SALES_REVIEW" && submittedAt) {
        const hoursInQueue = hoursBetween(submittedAt, now);
        if (hoursInQueue >= 48) acc.urgentInQueue += 1;
        if (hoursInQueue >= 72) acc.criticalInQueue += 1;
      }

      if (meta.lastDecision === "CHANGES_REQUESTED") {
        acc.reworkCases += 1;
      }
      if (meta.lastDecision === "CHANGES_REQUESTED") {
        Object.keys(meta.blockComments ?? {}).forEach((blockId) => {
          acc.blockIssueMap[blockId] = (acc.blockIssueMap[blockId] ?? 0) + 1;
        });
      }

      return acc;
    },
    {
      underPreSalesReview: 0,
      changesRequested: 0,
      approvedPreSales: 0,
      drafting: 0,
      urgentInQueue: 0,
      criticalInQueue: 0,
      reworkCases: 0,
      totalDecisionHours: 0,
      decisionsWithSla: 0,
      decisionSamples: [] as number[],
      blockIssueMap: {} as Record<string, number>,
    },
  );

  const emAndamento = typedSessions.filter((s) => s.status === "IN_PROGRESS").length;
  const pausadas = typedSessions.filter((s) => s.status === "PAUSED").length;
  const draftsByStatus = typedSessions.filter((s) => s.status === "DRAFT").length;
  const finalizadasPropostas = typedSessions.filter((s) => s.status === "FINALIZED").length;
  const arquivadas = typedSessions.filter((s) => s.status === "ARCHIVED").length;
  const totalPropostas = typedSessions.length;
  const finalizadasDocs = submissions.length;
  const bloqueadas = typedAudits.filter((a) => a.action === "DOCUMENT_GENERATION_BLOCKED").length;
  const preSalesSubmitted = typedAudits.filter(
    (a) => a.action === "PRE_SALES_SUBMIT_FOR_PRE_SALES" && a.createdAt >= periodStart,
  ).length;
  const preSalesDecisionsPeriod = typedAudits.filter(
    (a) =>
      (a.action === "PRE_SALES_APPROVE_TECHNICAL" || a.action === "PRE_SALES_REQUEST_CHANGES") &&
      a.createdAt >= periodStart,
  ).length;
  const entradasPeriodo = sessionsInPeriod.length;
  const docsPeriodo = submissionsInPeriod.length;
  const totalRecebidas = entradasPeriodo;
  const taxaConversao = entradasPeriodo === 0 ? 0 : Number(((docsPeriodo / entradasPeriodo) * 100).toFixed(1));
  const totalPreSalesDecisions = stageAgg.approvedPreSales + stageAgg.changesRequested;
  const preSalesApprovalRate =
    totalPreSalesDecisions === 0
      ? 0
      : Number(((stageAgg.approvedPreSales / totalPreSalesDecisions) * 100).toFixed(1));
  const preSalesSlaHours =
    stageAgg.decisionsWithSla === 0 ? 0 : Number((stageAgg.totalDecisionHours / stageAgg.decisionsWithSla).toFixed(1));
  const preSalesSlaP50 = Number(percentile(stageAgg.decisionSamples, 50).toFixed(1));
  const preSalesSlaP90 = Number(percentile(stageAgg.decisionSamples, 90).toFixed(1));

  const openSessions = typedSessions.filter((s) => s.status !== "FINALIZED" && s.status !== "ARCHIVED");
  const averageOpenAgeHours =
    openSessions.length === 0
      ? 0
      : Number(
          (
            openSessions.reduce((acc, s) => acc + hoursBetween(s.startedAt, now), 0) / openSessions.length
          ).toFixed(1),
        );
  const staleOver7d = openSessions.filter((s) => hoursBetween(s.updatedAt, now) >= 24 * 7).length;

  const docCoverageRate = totalPropostas === 0 ? 0 : Number(((finalizadasDocs / totalPropostas) * 100).toFixed(1));
  const reworkRate =
    totalPreSalesDecisions === 0 ? 0 : Number(((stageAgg.reworkCases / totalPreSalesDecisions) * 100).toFixed(1));
  const pauseRate = totalPropostas === 0 ? 0 : Number(((pausadas / totalPropostas) * 100).toFixed(1));
  const archiveRate = totalPropostas === 0 ? 0 : Number(((arquivadas / totalPropostas) * 100).toFixed(1));
  const userActivityMap = typedAudits.reduce(
    (acc, audit) => {
      const key = audit.userId;
      const entry = acc.get(key) ?? {
        userId: key,
        userName: audit.user?.name || audit.user?.email || "Usuário",
        totalActivities: 0,
        edits: 0,
        preSalesSubmissions: 0,
        preSalesApprovals: 0,
        preSalesChangesRequested: 0,
      };
      entry.totalActivities += 1;
      if (audit.action === "PROPOSAL_UPDATED") entry.edits += 1;
      if (audit.action === "PRE_SALES_SUBMIT_FOR_PRE_SALES") entry.preSalesSubmissions += 1;
      if (audit.action === "PRE_SALES_APPROVE_TECHNICAL") entry.preSalesApprovals += 1;
      if (audit.action === "PRE_SALES_REQUEST_CHANGES") entry.preSalesChangesRequested += 1;
      acc.set(key, entry);
      return acc;
    },
    new Map<
      string,
      {
        userId: string;
        userName: string;
        totalActivities: number;
        edits: number;
        preSalesSubmissions: number;
        preSalesApprovals: number;
        preSalesChangesRequested: number;
      }
    >(),
  );
  const userActivity = Array.from(userActivityMap.values())
    .sort((a, b) => b.totalActivities - a.totalActivities)
    .slice(0, 8);

  const firstActionBySession = typedAudits.reduce(
    (acc, audit) => {
      if (!audit.formSessionId) return acc;
      const existing = acc.get(audit.formSessionId);
      if (!existing || audit.createdAt < existing) {
        acc.set(audit.formSessionId, audit.createdAt);
      }
      return acc;
    },
    new Map<string, Date>(),
  );
  const firstActionSamples = typedSessions
    .filter((s) => s.startedAt >= periodStart)
    .map((s) => {
      const firstAction = firstActionBySession.get(s.id);
      if (!firstAction) return null;
      return hoursBetween(s.startedAt, firstAction);
    })
    .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);
  const firstActionHoursAvg =
    firstActionSamples.length === 0
      ? 0
      : Number((firstActionSamples.reduce((acc, cur) => acc + cur, 0) / firstActionSamples.length).toFixed(1));

  const leadTimeSamples = typedSessions
    .map((s) => {
      if (!s.finalizedAt) return null;
      return hoursBetween(s.startedAt, s.finalizedAt);
    })
    .filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);
  const leadTimeHoursAvg =
    leadTimeSamples.length === 0
      ? 0
      : Number((leadTimeSamples.reduce((acc, cur) => acc + cur, 0) / leadTimeSamples.length).toFixed(1));

  const backlogByOwnerMap = typedSessions.reduce(
    (acc, s) => {
      if (s.status === "FINALIZED" || s.status === "ARCHIVED") return acc;
      const ownerName = s.createdBy?.name || s.createdBy?.email || "Sem responsável";
      acc[ownerName] = (acc[ownerName] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const backlogByOwner = Object.entries(backlogByOwnerMap)
    .map(([owner, value]) => ({ owner, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const sessionsWithoutUpdate48h = typedSessions.filter((s) => hoursBetween(s.updatedAt, now) >= 48).length;
  const multiReworkCount = typedSessions.filter((s) => {
    const perSessionRequests = typedAudits.filter(
      (a) => a.formSessionId === s.id && a.action === "PRE_SALES_REQUEST_CHANGES",
    ).length;
    return perSessionRequests > 1;
  }).length;
  const topIssueBlocks = Object.entries(stageAgg.blockIssueMap)
    .map(([blockId, value]) => ({ blockId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousEntradas = typedSessions.filter(
    (s) => s.startedAt >= previousPeriodStart && s.startedAt < periodStart,
  ).length;
  const trendEntradasPct =
    previousEntradas === 0
      ? (entradasPeriodo > 0 ? 100 : 0)
      : Number((((entradasPeriodo - previousEntradas) / previousEntradas) * 100).toFixed(1));
  const previousDocs = typedSubmissions.filter(
    (s) => s.generatedAt >= previousPeriodStart && s.generatedAt < periodStart,
  ).length;
  const trendDocsPct =
    previousDocs === 0
      ? (docsPeriodo > 0 ? 100 : 0)
      : Number((((docsPeriodo - previousDocs) / previousDocs) * 100).toFixed(1));

  return NextResponse.json({
    periodDays,
    kpis: {
      totalRecebidas,
      totalPropostas,
      emAndamento,
      pausadas: pausadas + draftsByStatus,
      pausadasEstritas: pausadas,
      finalizadas: finalizadasPropostas,
      documentosGerados: docsPeriodo,
      bloqueadas,
      urgentes: stageAgg.urgentInQueue,
      criticas: stageAgg.criticalInQueue,
      arquivadas,
      taxaConversao,
      preSalesInReview: stageAgg.underPreSalesReview,
      preSalesChangesRequested: stageAgg.changesRequested,
      preSalesApproved: stageAgg.approvedPreSales,
      drafting: stageAgg.drafting,
      preSalesApprovalRate,
      preSalesSlaHours,
      preSalesSlaP50,
      preSalesSlaP90,
      preSalesSubmitted,
      preSalesDecisionsLast30: preSalesDecisionsPeriod,
      averageOpenAgeHours,
      staleOver7d,
      docCoverageRate,
      reworkRate,
      pauseRate,
      archiveRate,
    },
    monthly,
    stageDistribution: [
      { stage: "Rascunho", value: stageAgg.drafting },
      { stage: "Em revisão pré-vendas", value: stageAgg.underPreSalesReview },
      { stage: "Ajustes solicitados", value: stageAgg.changesRequested },
      { stage: "Aprovadas técn.", value: stageAgg.approvedPreSales },
    ],
    userActivity,
    advanced: {
      firstActionHoursAvg,
      leadTimeHoursAvg,
      sessionsWithoutUpdate48h,
      multiReworkCount,
      trendEntradasPct,
      trendDocsPct,
      backlogByOwner,
      topIssueBlocks,
    },
    statusDistribution: [
      { status: "Em andamento", value: emAndamento },
      { status: "Pausadas / rascunho", value: pausadas + draftsByStatus },
      { status: "Finalizadas", value: finalizadasPropostas },
      { status: "Arquivadas", value: arquivadas },
      { status: "Bloqueadas (doc)", value: bloqueadas },
    ],
  });
}
