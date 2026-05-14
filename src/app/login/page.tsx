"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, labelClass, btnPrimary } from "@/lib/uiClasses";

export default function LoginPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("redirect");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedirectTo(raw);
    }
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: "Falha no login." }))) as { error?: string };
      setError(payload.error ?? "Falha no login.");
      return;
    }
    const payload = (await res.json().catch(() => ({}))) as {
      requiresCompanySelection?: boolean;
    };
    const destination = payload.requiresCompanySelection ? "/select-company" : redirectTo;
    router.push(destination);
    router.refresh();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface-50">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(75,95,255,0.16),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">FormSis</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-surface-900">Iniciar sessão</h1>
          <p className="mt-2 text-sm text-surface-500">Acesso interno com e-mail e senha.</p>
        </div>
        <div className="rounded-2xl border border-surface-200/90 bg-surface-0/90 p-6 shadow-xl shadow-surface-950/10 ring-1 ring-surface-950/5 backdrop-blur-sm sm:p-8">
          <form className="space-y-5" onSubmit={onSubmit}>
            <label className={labelClass}>
              E-mail
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className={labelClass}>
              Senha
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-red-200/80 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            ) : null}
            <button className={`${btnPrimary} w-full`} type="submit">
              Entrar
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-surface-400">Contas geridas por administrador.</p>
      </div>
    </main>
  );
}
