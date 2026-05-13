"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { perfilUsuarioPt } from "@/lib/uiLabels";

type NavKey = "dashboard" | "propostas" | "documentos" | "validacoes" | "admin";

const navItemBase = "block rounded-lg px-3 py-2.5 text-sm font-medium transition";

export function AppShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        const dest = pathname && pathname !== "/login" ? pathname : "/dashboard";
        router.replace(`/login?redirect=${encodeURIComponent(dest)}`);
        return;
      }
      const me = (await meRes.json()) as { user: { name: string; role: string } };
      setUser(me.user);
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
          <div className="m-2 mt-auto space-y-2 rounded-xl border border-surface-700/55 bg-surface-950/35 p-3.5 text-xs text-surface-300">
            <div>
              <p className="font-medium text-surface-0">{user?.name ?? "..."}</p>
              <p className="mt-0.5 text-[11px] text-surface-400">{user?.role ? perfilUsuarioPt(user.role) : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full rounded-lg border border-surface-600/60 bg-surface-800/50 px-2 py-2 text-left text-[11px] font-medium text-surface-100 transition hover:border-surface-500/80 hover:bg-surface-800/80"
            >
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
