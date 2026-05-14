"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AppCard } from "@/components/AppCard";
import { PageHeader } from "@/components/PageHeader";
import { inputClass, labelClass, btnPrimary, btnSecondary } from "@/lib/uiClasses";
import { perfilUsuarioPt } from "@/lib/uiLabels";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
};

type UserCompany = { id: string; name: string; slug: string };

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  companies: UserCompany[];
  companyIds: string[];
  createdAt: string;
  updatedAt: string;
};

const roles = [
  { value: "SUPER_ADMIN", label: "Super Administrador" },
  { value: "ADMIN", label: "Administrador" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "PRE_VENDAS", label: "Pre-vendas" },
  { value: "LEITURA", label: "Leitura" },
] as const;

function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const [meRole, setMeRole] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);

  const [userCompanyFilter, setUserCompanyFilter] = useState<string>("");

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<string>("COMERCIAL");
  const [createCompanyIds, setCreateCompanyIds] = useState<Set<string>>(new Set());

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("COMERCIAL");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editCompanyIds, setEditCompanyIds] = useState<Set<string>>(new Set());

  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanySlug, setNewCompanySlug] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [companyActive, setCompanyActive] = useState(true);

  const isSuperAdmin = meRole === "SUPER_ADMIN";
  const canAccess = meRole === "SUPER_ADMIN" || meRole === "ADMIN";

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.active),
    [companies],
  );

  const loadUsers = useCallback(
    async (role: string) => {
      const query = role === "SUPER_ADMIN" && userCompanyFilter
        ? `?companyId=${encodeURIComponent(userCompanyFilter)}`
        : "";
      const res = await fetch(`/api/admin/users${query}`);
      if (!res.ok) {
        setError("Falha ao carregar usuarios.");
        return;
      }
      const data = (await res.json()) as { users: UserRow[] };
      setUsers(data.users);
    },
    [userCompanyFilter],
  );

  const loadCompanies = useCallback(async () => {
    const response = await fetch("/api/admin/companies");
    if (!response.ok) {
      setError("Falha ao carregar empresas.");
      return [] as CompanyRow[];
    }
    const payload = (await response.json()) as { companies: CompanyRow[] };
    setCompanies(payload.companies);
    return payload.companies;
  }, []);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);

    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.replace("/login?redirect=" + encodeURIComponent("/admin/usuarios"));
      return;
    }
    const me = (await meRes.json()) as { user: { role: string } };
    setMeRole(me.user.role);

    if (me.user.role !== "SUPER_ADMIN" && me.user.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    if (me.user.role === "SUPER_ADMIN") {
      await loadCompanies();
    }

    await loadUsers(me.user.role);
    setLoading(false);
  }, [loadCompanies, loadUsers, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      name: createName.trim(),
      email: createEmail.trim().toLowerCase(),
      password: createPassword,
      role: createRole,
    };

    if (isSuperAdmin) {
      const ids = Array.from(createCompanyIds);
      if (createRole !== "SUPER_ADMIN" && ids.length === 0) {
        setSaving(false);
        setError("Selecione ao menos uma empresa para o usuario.");
        return;
      }
      payload.companyIds = ids;
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Falha ao criar usuario.");
      return;
    }

    setCreateName("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("COMERCIAL");
    setCreateCompanyIds(new Set());
    await load();
  };

  const onUpdateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

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

    if (isSuperAdmin) {
      const ids = Array.from(editCompanyIds);
      if (editRole !== "SUPER_ADMIN" && ids.length === 0) {
        setSaving(false);
        setError("Selecione ao menos uma empresa para o usuario.");
        return;
      }
      payload.companyIds = ids;
    }

    const res = await fetch(`/api/admin/users/${encodeURIComponent(editingUser.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Falha ao guardar usuario.");
      return;
    }

    setEditingUser(null);
    await load();
  };

  const onCreateCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newCompanyName.trim(),
        slug: newCompanySlug.trim().toLowerCase(),
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Falha ao criar empresa.");
      return;
    }

    setNewCompanyName("");
    setNewCompanySlug("");
    await load();
  };

  const onOpenCompanyEdit = (company: CompanyRow) => {
    setEditingCompany(company);
    setCompanyName(company.name);
    setCompanySlug(company.slug);
    setCompanyActive(company.active);
  };

  const onUpdateCompany = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    setSaving(true);
    setError("");

    const res = await fetch(`/api/admin/companies/${encodeURIComponent(editingCompany.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: companyName.trim(),
        slug: companySlug.trim().toLowerCase(),
        active: companyActive,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(b.error ?? "Falha ao atualizar empresa.");
      return;
    }

    setEditingCompany(null);
    await load();
  };

  if (loading) {
    return (
      <AppShell active="admin">
        <p className="text-sm text-surface-500">A carregar...</p>
      </AppShell>
    );
  }

  if (!canAccess) {
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
        action={
          <Link className={btnSecondary} href="/admin/questionarios">
            Gerir questionarios
          </Link>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      {isSuperAdmin ? (
        <AppCard className="mb-6">
          <h2 className="text-sm font-semibold text-surface-900">Empresas</h2>
          <p className="mb-4 mt-0.5 text-xs text-surface-500">
            SUPER_ADMIN pode criar e manter as empresas ativas da plataforma.
          </p>

          <form onSubmit={onCreateCompany} className="mb-5 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
            <label className={labelClass}>
              Nome da empresa
              <input
                required
                className={inputClass}
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            </label>
            <label className={labelClass}>
              Slug
              <input
                required
                className={inputClass}
                value={newCompanySlug}
                onChange={(e) => setNewCompanySlug(e.target.value)}
                placeholder="ex: nova-empresa"
              />
            </label>
            <div className="md:self-end">
              <button type="submit" disabled={saving} className={btnPrimary}>
                Criar empresa
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-200/90 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Usuarios</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {companies.map((company) => (
                  <tr key={company.id} className="text-surface-800 transition hover:bg-brand-500/8">
                    <td className="px-4 py-3 font-medium">{company.name}</td>
                    <td className="px-4 py-3 text-surface-600">{company.slug}</td>
                    <td className="px-4 py-3 text-surface-600">{company._count?.users ?? 0}</td>
                    <td className="px-4 py-3">
                      {company.active ? (
                        <span className="inline-flex rounded-md bg-emerald-100/90 px-2 py-0.5 text-xs font-medium text-emerald-900">
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-surface-200/90 px-2 py-0.5 text-xs font-medium text-surface-800">
                          Inativa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        onClick={() => onOpenCompanyEdit(company)}
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
      ) : null}

      <AppCard className="mb-6">
        <h2 className="text-sm font-semibold text-surface-900">Novo usuario</h2>
        <p className="mb-4 mt-0.5 text-xs text-surface-500">A senha pode ser alterada depois na edicao.</p>

        {isSuperAdmin ? (
          <div className="mb-4 max-w-sm">
            <label className={labelClass}>
              Filtrar listagem por empresa
              <select
                className={inputClass}
                value={userCompanyFilter}
                onChange={(e) => setUserCompanyFilter(e.target.value)}
              >
                <option value="">Todas as empresas</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.slug})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <form onSubmit={onCreateUser} className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
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
            Senha inicial (min. 8 caracteres)
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

          {isSuperAdmin ? (
            <fieldset className={`md:col-span-2 ${labelClass}`}>
              <legend className={labelClass}>Empresas vinculadas</legend>
              <p className="mt-1 text-[11px] font-normal text-surface-500">
                Marque uma ou mais empresas que o usuario poderá selecionar ao entrar.
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {activeCompanies.length === 0 ? (
                  <p className="text-xs text-surface-500">Nenhuma empresa ativa disponivel.</p>
                ) : (
                  activeCompanies.map((company) => {
                    const checked = createCompanyIds.has(company.id);
                    return (
                      <label
                        key={company.id}
                        className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs font-medium text-surface-800 transition hover:border-brand-300"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                          checked={checked}
                          onChange={() =>
                            setCreateCompanyIds((prev) => toggleId(prev, company.id))
                          }
                        />
                        <span className="flex flex-col leading-tight">
                          <span>{company.name}</span>
                          <span className="text-[10px] uppercase tracking-wider text-surface-500">
                            {company.slug}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </fieldset>
          ) : null}

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
                {isSuperAdmin ? <th className="px-4 py-3 sm:px-5">Empresas</th> : null}
                <th className="px-4 py-3 sm:px-5">Perfil</th>
                <th className="px-4 py-3 sm:px-5">Estado</th>
                <th className="px-4 py-3 text-right sm:px-5">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {users.map((u) => (
                <tr key={u.id} className="text-surface-800 transition hover:bg-brand-500/8">
                  <td className="px-4 py-3 text-sm font-medium sm:px-5">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-surface-600 sm:px-5">{u.email}</td>
                  {isSuperAdmin ? (
                    <td className="px-4 py-3 text-sm text-surface-600 sm:px-5">
                      {u.companies.length > 0
                        ? u.companies.map((company) => company.name).join(", ")
                        : "Sem empresa"}
                    </td>
                  ) : null}
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
                        setEditingUser(u);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditRole(u.role);
                        setEditActive(u.active);
                        setEditPassword("");
                        setEditCompanyIds(new Set(u.companyIds));
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

      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-surface-200/90 bg-surface-0 p-5 shadow-2xl ring-1 ring-surface-950/10 sm:p-6">
            <h2 className="text-sm font-semibold text-surface-900">Editar: {editingUser.name}</h2>
            <form onSubmit={onUpdateUser} className="mt-4 space-y-4">
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

              {isSuperAdmin ? (
                <fieldset className={labelClass}>
                  <legend className={labelClass}>Empresas vinculadas</legend>
                  <div className="mt-2 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {activeCompanies.length === 0 ? (
                      <p className="text-xs text-surface-500">Nenhuma empresa ativa disponivel.</p>
                    ) : (
                      activeCompanies.map((company) => {
                        const checked = editCompanyIds.has(company.id);
                        return (
                          <label
                            key={company.id}
                            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-xs font-medium text-surface-800 transition hover:border-brand-300"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                              checked={checked}
                              onChange={() =>
                                setEditCompanyIds((prev) => toggleId(prev, company.id))
                              }
                            />
                            <span className="flex flex-col leading-tight">
                              <span>{company.name}</span>
                              <span className="text-[10px] uppercase tracking-wider text-surface-500">
                                {company.slug}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </fieldset>
              ) : null}

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
                Nova senha (opcional, min. 8 caracteres)
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
                <button type="button" className={btnSecondary} onClick={() => setEditingUser(null)}>
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

      {editingCompany && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-surface-200/90 bg-surface-0 p-5 shadow-2xl ring-1 ring-surface-950/10 sm:p-6">
            <h2 className="text-sm font-semibold text-surface-900">Editar empresa: {editingCompany.name}</h2>
            <form onSubmit={onUpdateCompany} className="mt-4 space-y-4">
              <label className={labelClass}>
                Nome
                <input required className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </label>
              <label className={labelClass}>
                Slug
                <input
                  required
                  className={inputClass}
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-surface-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                  checked={companyActive}
                  onChange={(e) => setCompanyActive(e.target.checked)}
                />
                Empresa ativa
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" className={btnSecondary} onClick={() => setEditingCompany(null)}>
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
