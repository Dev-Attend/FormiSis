"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { perfilUsuarioPt } from "@/lib/uiLabels";

type NavKey = "dashboard" | "propostas" | "documentos" | "validacoes" | "admin";

type Company = { id: string; name: string; slug: string };
type ShellUser = {
  name: string;
  role: string;
  activeCompany: Company | null;
};

const navItemBase = "block rounded-lg px-3 py-2.5 text-sm font-medium transition";

export function AppShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ShellUser | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        const dest = pathname && pathname !== "/login" ? pathname : "/dashboard";
        router.replace(`/login?redirect=${encodeURIComponent(dest)}`);
        return;
      }
      const me = (await meRes.json()) as {
        user: { name: string; role: string; activeCompany: Company | null };
        availableCompanies: Company[];
      };
      setUser({
        name: me.user.name,
        role: me.user.role,
        activeCompany: me.user.activeCompany,
      });
      setAvailableCompanies(me.availableCompanies ?? []);
    })();
  }, [router, pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isNova = pathname === "/propostas/nova";
  const navOn = (key: NavKey) => {
    if (key === "propostas") return active === "propostas" && !isNova;
    return active === key;
  };
  const navLink = (key: NavKey) =>
    navOn(key)
      ? `${navItemBase} bg-brand-500/22 text-white ring-1 ring-brand-300/35`
      : `${navItemBase} text-surface-400 hover:bg-white/8 hover:text-surface-0`;

  /* Mesmo padrão visual que os restantes: destaque só na rota ativa (antes estava “sempre” como CTA). */
  const navItemNovaClass = isNova
    ? `${navItemBase} bg-brand-500/22 text-white ring-1 ring-brand-300/35`
    : `${navItemBase} text-surface-400 hover:bg-white/8 hover:text-surface-0`;

  const canSwitchCompany =
    user?.role === "SUPER_ADMIN" || availableCompanies.length > 1;

  return (
    <main className="h-screen overflow-hidden">
      <div className="grid h-screen grid-cols-1 lg:grid-cols-[14.5rem_1fr]">
        <aside className="sticky top-0 flex h-screen min-h-0 flex-col overflow-y-auto border-r border-surface-700/50 bg-sidebar-bg text-surface-100">
          <div className="border-b border-surface-700/50 px-3 py-2.5">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-brand-300">FormSis</p>
            <h1 className="mt-0.5 text-sm font-semibold leading-tight tracking-tight text-surface-0">Propostas</h1>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            <Link className={navLink("dashboard")} href="/dashboard">
              Dashboard
            </Link>
            {user && user.role !== "LEITURA" ? (
              <Link href="/propostas/nova" className={navItemNovaClass}>
                Nova proposta
              </Link>
            ) : null}
            <Link className={navLink("propostas")} href="/propostas">
              Fila de propostas
            </Link>
            {(user?.role === "PRE_VENDAS" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
              <Link className={navLink("validacoes")} href="/pre-vendas/validacoes">
                Pré-vendas
              </Link>
            )}
            <Link className={navLink("documentos")} href="/submissoes">
              Documentos
            </Link>
            {user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? (
              <Link className={navLink("admin")} href="/admin/usuarios">
                Usuarios
              </Link>
            ) : null}
          </nav>
          {user && (user.activeCompany || canSwitchCompany) ? (
            <div className="mx-2 mt-2 rounded-xl border border-surface-700/55 bg-surface-950/40 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-surface-400">
                Empresa ativa
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/85 text-sm font-semibold text-white shadow-sm shadow-brand-900/30"
                  aria-hidden
                >
                  {(user.activeCompany?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-0">
                    {user.activeCompany?.name ?? "Nenhuma selecionada"}
                  </p>
                  {user.activeCompany?.slug ? (
                    <p className="truncate text-[10px] text-surface-400">@{user.activeCompany.slug}</p>
                  ) : null}
                </div>
              </div>
              {canSwitchCompany ? (
                <button
                  type="button"
                  onClick={() => router.push("/select-company")}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600/60 bg-surface-800/40 px-2.5 py-1.5 text-[11px] font-medium text-surface-100 transition hover:border-brand-400/60 hover:bg-surface-800/80"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                    <path
                      d="M7 4l-3 3 3 3M4 7h9a3 3 0 013 3v0M13 16l3-3-3-3M16 13H7a3 3 0 01-3-3v0"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Trocar empresa
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="m-2 mt-2 rounded-xl border border-surface-700/55 bg-surface-950/40 p-3">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-900/30"
                aria-hidden
              >
                {(user?.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-surface-0">{user?.name ?? "..."}</p>
                <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-brand-300">
                  {user?.role ? perfilUsuarioPt(user.role) : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-600/60 bg-surface-800/50 px-2.5 py-1.5 text-[11px] font-medium text-surface-100 transition hover:border-red-400/55 hover:bg-red-500/12 hover:text-red-100"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M12 4h2.5A1.5 1.5 0 0116 5.5v9A1.5 1.5 0 0114.5 16H12M9 13l-3-3 3-3M6 10h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Sair
            </button>
          </div>
        </aside>
        <section className="h-screen min-h-0 overflow-y-auto bg-surface-50">
          <div className="h-full w-full px-2 pt-2 pb-0 sm:px-3 sm:pt-3 sm:pb-0 lg:px-4">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
