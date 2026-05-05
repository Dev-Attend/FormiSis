export type PreSalesStage =
  | "DRAFTING"
  | "UNDER_PRE_SALES_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED_PRE_SALES";

export type PreSalesChecklist = {
  scopeValidated: boolean;
  technicalFeasibilityValidated: boolean;
  sizingValidated: boolean;
  slaValidated: boolean;
  risksValidated: boolean;
  complianceValidated: boolean;
};

export type PreSalesBlockComments = Record<string, string>;

export type PreSalesMeta = {
  stage: PreSalesStage;
  checklist: PreSalesChecklist;
  blockComments: PreSalesBlockComments;
  requestedFieldIds?: string[];
  lastDecisionByRole?: "PRE_VENDAS" | "ADMIN";
  lastDecisionAt?: string;
  lastDecision?: "APPROVED" | "CHANGES_REQUESTED";
  lastComment?: string;
  submittedById?: string;
  submittedAt?: string;
};

export const PRE_SALES_META_KEY = "__preSalesMeta";

export const defaultPreSalesChecklist: PreSalesChecklist = {
  scopeValidated: false,
  technicalFeasibilityValidated: false,
  sizingValidated: false,
  slaValidated: false,
  risksValidated: false,
  complianceValidated: false,
};

export const defaultPreSalesMeta: PreSalesMeta = {
  stage: "DRAFTING",
  checklist: { ...defaultPreSalesChecklist },
  blockComments: {},
};

export function parsePreSalesMeta(payload: Record<string, string>): PreSalesMeta {
  const raw = payload[PRE_SALES_META_KEY];
  if (!raw) return { ...defaultPreSalesMeta, checklist: { ...defaultPreSalesChecklist }, blockComments: {} };
  try {
    const v = JSON.parse(raw) as Partial<PreSalesMeta>;
    return {
      stage: v.stage ?? "DRAFTING",
      checklist: {
        ...defaultPreSalesChecklist,
        ...(v.checklist ?? {}),
      },
      blockComments:
        v.blockComments && typeof v.blockComments === "object" ? { ...v.blockComments } : {},
      requestedFieldIds: Array.isArray(v.requestedFieldIds) ? v.requestedFieldIds.filter((x) => typeof x === "string") : [],
      lastDecisionByRole: v.lastDecisionByRole,
      lastDecisionAt: v.lastDecisionAt,
      lastDecision: v.lastDecision,
      lastComment: v.lastComment,
      submittedById: v.submittedById,
      submittedAt: v.submittedAt,
    };
  } catch {
    return { ...defaultPreSalesMeta, checklist: { ...defaultPreSalesChecklist }, blockComments: {} };
  }
}

export function applyPreSalesMeta(
  payload: Record<string, string>,
  meta: PreSalesMeta,
): Record<string, string> {
  return {
    ...payload,
    [PRE_SALES_META_KEY]: JSON.stringify(meta),
  };
}

export function isChecklistComplete(checklist: PreSalesChecklist) {
  return Object.values(checklist).every(Boolean);
}

export function canCommercialEditStage(stage: PreSalesStage) {
  return stage === "DRAFTING" || stage === "CHANGES_REQUESTED";
}
