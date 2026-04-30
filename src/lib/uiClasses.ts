/** Classes reutilizadas para UI coerente (limpa, moderna, foco e estados claros). */

export const inputClass =
  "mt-1.5 w-full rounded-xl border border-surface-200 bg-surface-0 px-3.5 py-2.5 text-sm text-surface-900 shadow-sm transition placeholder:text-surface-400 focus:border-brand-500/75 focus:outline-none focus:ring-4 focus:ring-brand-500/18 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-500";

export const labelClass = "block text-xs font-medium text-surface-600";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-surface-900 px-4 py-2.5 text-sm font-medium text-surface-0 shadow-sm transition hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500/45 focus:ring-offset-2 disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-surface-200 bg-surface-0 px-4 py-2.5 text-sm font-medium text-surface-800 shadow-sm transition hover:border-surface-300 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-500/22 focus:ring-offset-1";

export const btnAccent =
  "inline-flex items-center justify-center rounded-lg bg-brand-500 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-brand-900/15 transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/45 focus:ring-offset-1 disabled:opacity-50";

/** Formulário de proposta: inputs e ações mais densos (menos altura). */
export const inputCompactClass =
  "mt-0.5 w-full rounded-lg border border-surface-200 bg-surface-0 px-2.5 py-1.5 text-sm leading-tight text-surface-900 shadow-sm transition placeholder:text-surface-400 focus:border-brand-500/75 focus:outline-none focus:ring-2 focus:ring-brand-500/22 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-500";

export const labelCompactClass = "block text-[11px] font-medium leading-tight text-surface-600";

export const btnCompact =
  "inline-flex items-center justify-center rounded-lg bg-surface-900 px-3 py-1.5 text-xs font-medium text-surface-0 shadow-sm transition hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-brand-500/38 disabled:cursor-not-allowed disabled:opacity-50";

export const btnAccentCompact = btnAccent;
