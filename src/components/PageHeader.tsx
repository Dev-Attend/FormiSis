import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-2 flex flex-col gap-1.5 sm:mb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold tracking-tight text-surface-900">{title}</h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-[11px] leading-snug text-surface-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
