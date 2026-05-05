"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AppCard } from "@/components/AppCard";
import { PageHeader } from "@/components/PageHeader";
import { inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/uiClasses";
import { perfilUsuarioPt } from "@/lib/uiLabels";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const roles = [
  { value: "ADMIN", label: "Administrador" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "PRE_VENDAS", label: "Pre-vendas" },
  { value: "LEITURA", label: "Leitura" },
] as const;

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [meRole, setMeRole] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<string>("COMERCIAL");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("COMERCIAL");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");

  const load = useCallback(async () => {
    setError("");
    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.replace("/login?redirect=" + encodeURIComponent("/admin/usuarios"));
      return;
    }
    const me = (await meRes.json()) as { user: { role: string } };
    setMeRole(me.user.role);
    if (me.user.role !== "ADMIN") {
      setLoading(false);
      return;
    }
    const res = await fetch("/api/admin/users");
    if (!res.ok) {
      setError("Falha ao carregar usuarios.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { users: UserRow[] };
    setUsers(data.users);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createName.trim(),
        email: createEmail.trim().toLowerCase(),
        password: createPassword,
        role: createRole,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Falha ao criar.");
      return;
    }
    setCreateName("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("COMERCIAL");
    await load();
  };

  const onUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      role: editRole,
      active: editActive,
    };
    if (editPassword.trim().length >= 8) {
      payload.password = editPassword;
    }
    const res = await fetch(`/api/admin/users/${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Falha ao guardar.");
      return;
    }
    setEditing(null);
    await load();
  };

  if (loading) {
    return (
      <AppShell active="admin">
        <p className="text-sm text-surface-500">A carregar…</p>
      </AppShell>
    );
  }

  if (meRole !== "ADMIN") {
    return (
      <AppShell active="admin">
        <AppCard className="max-w-md border-amber-200/80 bg-amber-50/50">
          <p className="text-sm font-medium text-amber-950">Acesso reservado a administradores.</p>
          <Link className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:underline" href="/dashboard">
            Voltar ao painel
          </Link>
        </AppCard>
      </AppShell>
    );
  }

  return (
    <AppShell active="admin">
      <PageHeader
        title="Usuarios"
        description="Criar contas, alterar perfis e ativar ou desativar acessos ao FormSis."
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      <AppCard className="mb-6">
        <h2 className="text-sm font-semibold text-surface-900">Novo usuario</h2>
        <p className="mb-4 mt-0.5 text-xs text-surface-500">A senha pode ser alterada depois na edição.</p>
        <form onSubmit={onCreate} className="grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Nome
            <input
              required
              className={inputClass}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            E-mail
            <input
              required
              type="email"
              className={inputClass}
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Senha inicial (mín. 8 caracteres)
            <input
              required
              type="password"
              minLength={8}
              className={inputClass}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Perfil
            <select
              className={inputClass}
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              Criar usuario
            </button>
          </div>
        </form>
      </AppCard>

      <AppCard className="overflow-x-auto" padding="p-0 sm:p-0">
        <div className="p-1 sm:p-1">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-200/90 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                <th className="px-4 py-3 sm:px-5">Nome</th>
                <th className="px-4 py-3 sm:px-5">E-mail</th>
                <th className="px-4 py-3 sm:px-5">Perfil</th>
                <th className="px-4 py-3 sm:px-5">Estado</th>
                <th className="px-4 py-3 text-right sm:px-5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
            {users.map((u) => (
              <tr key={u.id} className="text-surface-800 transition hover:bg-brand-500/8">
                <td className="px-4 py-3 text-sm font-medium sm:px-5">{u.name}</td>
                <td className="px-4 py-3 text-sm text-surface-600 sm:px-5">{u.email}</td>
                <td className="px-4 py-3 sm:px-5">{perfilUsuarioPt(u.role)}</td>
                <td className="px-4 py-3 sm:px-5">
                  {u.active ? (
                    <span className="inline-flex rounded-md bg-emerald-100/90 px-2 py-0.5 text-xs font-medium text-emerald-900">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md bg-surface-200/90 px-2 py-0.5 text-xs font-medium text-surface-800">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right sm:px-5">
                  <button
                    type="button"
                    className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    onClick={() => {
                      setEditing(u);
                      setEditName(u.name);
                      setEditEmail(u.email);
                      setEditRole(u.role);
                      setEditActive(u.active);
                      setEditPassword("");
                    }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-surface-200/90 bg-surface-0 p-5 shadow-2xl ring-1 ring-surface-950/10 sm:p-6">
            <h2 className="text-sm font-semibold text-surface-900">Editar: {editing.name}</h2>
            <form onSubmit={onUpdate} className="mt-4 space-y-4">
              <label className={labelClass}>
                Nome
                <input required className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label className={labelClass}>
                E-mail
                <input
                  required
                  type="email"
                  className={inputClass}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Perfil
                <select className={inputClass} value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-surface-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                Conta ativa
              </label>
              <label className={labelClass}>
                Nova senha (opcional, mín. 8 caracteres)
                <input
                  type="password"
                  minLength={8}
                  className={inputClass}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Vazio = manter a atual"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
