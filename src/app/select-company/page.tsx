"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "@/lib/uiClasses";

type Company = { id: string; name: string; slug: string };

export default function SelectCompanyPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/companies");
      if (res.status === 401) {
        router.replace("/login?redirect=/select-company");
        return;
      }
      if (!res.ok) {
        setError("Nao foi possivel carregar a lista de empresas.");
        return;
      }
      const data = (await res.json()) as { companies: Company[] };
      setCompanies(data.companies);
    })();
  }, [router]);

  const onSelect = async (company: Company) => {
    setError(null);
    setSubmittingId(company.id);
    try {
      const res = await fetch("/api/auth/select-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Falha ao selecionar empresa.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setSubmittingId(null);
    }
  };

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface-50">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(75,95,255,0.18),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-4 py-16 sm:px-6">
        <header className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">
            FormiSis
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-surface-900">
            Com qual empresa você deseja acessar?
          </h1>
          <p className="mt-3 text-sm text-surface-500">
            Escolha a empresa para iniciar sua sessão no FormiSis.
          </p>
        </header>

        {error ? (
          <p className="mx-auto mb-6 max-w-md rounded-lg border border-red-200/80 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {companies === null ? (
          <p className="text-center text-sm text-surface-500">Carregando empresas...</p>
        ) : companies.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-surface-200 bg-surface-0 p-6 text-center text-sm text-surface-600 shadow-sm">
            <p>Nenhuma empresa disponivel para sua conta.</p>
            <p className="mt-2 text-xs text-surface-500">
              Contate um administrador para vincular sua conta a uma empresa.
            </p>
          </div>
        ) : (
          <div className="mx-auto grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => {
              const initials = company.name.trim().charAt(0).toUpperCase() || "?";
              const isLoading = submittingId === company.id;
              return (
                <button
                  type="button"
                  key={company.id}
                  onClick={() => void onSelect(company)}
                  disabled={Boolean(submittingId)}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-surface-200/90 bg-surface-0 px-6 py-7 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-brand-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl font-semibold text-white shadow-sm shadow-brand-900/20 transition group-hover:bg-brand-600"
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-semibold text-surface-900">
                      {company.name}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-surface-400">
                      {company.slug}
                    </span>
                  </span>
                  {isLoading ? (
                    <span className="text-[11px] text-brand-500">Selecionando...</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <button type="button" onClick={() => void onLogout()} className={btnSecondary}>
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}
