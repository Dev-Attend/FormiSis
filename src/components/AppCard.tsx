import type { ReactNode } from "react";

/** Sombra suave a partir de surface-900 (#1a1d2e), coerente com o design system */
const cardShadow =
  "shadow-[0_1px_2px_rgb(26_29_46_/_0.06),0_0_0_1px_rgb(26_29_46_/_0.04)]";

export function AppCard({
  children,
  className = "",
  padding = "p-4 sm:p-5",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-surface-200 bg-surface-0 ${cardShadow} ${padding} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
