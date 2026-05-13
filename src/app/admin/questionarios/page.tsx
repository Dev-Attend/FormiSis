"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AppCard } from "@/components/AppCard";
import { PageHeader } from "@/components/PageHeader";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/uiClasses";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

type BlockRow = {
  id: string;
  companyId: string;
  blockKey: string;
  title: string;
  description: string | null;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string; slug: string } | null;
  _count?: { questions: number };
};

export default function AdminQuestionariosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [meRole, setMeRole] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [editingBlock, setEditingBlock] = useState<BlockRow | null>(null);

  const [createBlockKey, setCreateBlockKey] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createOrder, setCreateOrder] = useState("1");

  const [editBlockKey, setEditBlockKey] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOrder, setEditOrder] = useState("1");
  const [editActive, setEditActive] = useState(true);

  const isSuperAdmin = meRole === "SUPER_ADMIN";
  const canAccess = meRole === "SUPER_ADMIN" || meRole === "ADMIN";

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.active),
    [companies],
  );

  const loadBlocks = useCallback(
    async (role: string, companyId: string) => {
      const query =
        role === "SUPER_ADMIN" && companyId
          ? `?companyId=${encodeURIComponent(companyId)}`
          : "";
      const response = await fetch(`/api/admin/form-blocks${query}`);
      if (!response.ok) {
        setError("Falha ao carregar blocos de questionario.");
        return;
      }
      const body = (await response.json()) as { blocks: BlockRow[] };
      setBlocks(body.blocks);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const meRes = await fetch("/api/auth/me");
    if (!meRes.ok) {
      router.replace("/login?redirect=" + encodeURIComponent("/admin/questionarios"));
      return;
    }
    const me = (await meRes.json()) as { user: { role: string } };
    setMeRole(me.user.role);

    if (me.user.role !== "SUPER_ADMIN" && me.user.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    if (me.user.role === "SUPER_ADMIN") {
      const companiesRes = await fetch("/api/admin/companies");
      if (!companiesRes.ok) {
        setError("Falha ao carregar empresas.");
        setLoading(false);
        return;
      }
      const companiesBody = (await companiesRes.json()) as { companies: CompanyRow[] };
      setCompanies(companiesBody.companies);

      const available = companiesBody.companies.filter((company) => company.active);
      const fallbackCompanyId = available[0]?.id ?? companiesBody.companies[0]?.id ?? "";
      const nextCompanyId = selectedCompanyId || fallbackCompanyId;

      setSelectedCompanyId(nextCompanyId);
      if (!nextCompanyId) {
        setBlocks([]);
        setLoading(false);
        return;
      }

      await loadBlocks("SUPER_ADMIN", nextCompanyId);
      setLoading(false);
      return;
    }

    await loadBlocks("ADMIN", "");
    setLoading(false);
  }, [loadBlocks, router, selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadBlocks = async () => {
    if (!meRole) return;
    await loadBlocks(meRole, selectedCompanyId);
  };

  const onChangeCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    if (!meRole) return;
    setError("");
    if (!companyId) {
      setBlocks([]);
      return;
    }
    await loadBlocks(meRole, companyId);
  };

  const onCreateBlock = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const parsedOrder = Number(createOrder);
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setSaving(false);
      setError("A ordem deve ser um numero inteiro maior ou igual a zero.");
      return;
    }

    const payload: Record<string, unknown> = {
      blockKey: createBlockKey.trim(),
      title: createTitle.trim(),
      description: createDescription.trim() || null,
      order: parsedOrder,
    };

    if (isSuperAdmin) {
      if (!selectedCompanyId) {
        setSaving(false);
        setError("Selecione uma empresa para criar o bloco.");
        return;
      }
      payload.companyId = selectedCompanyId;
    }

    const response = await fetch("/api/admin/form-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao criar bloco.");
      return;
    }

    setCreateBlockKey("");
    setCreateTitle("");
    setCreateDescription("");
    setCreateOrder("1");
    await reloadBlocks();
  };

  const onOpenEditBlock = (block: BlockRow) => {
    setEditingBlock(block);
    setEditBlockKey(block.blockKey);
    setEditTitle(block.title);
    setEditDescription(block.description ?? "");
    setEditOrder(String(block.order));
    setEditActive(block.active);
  };

  const onUpdateBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingBlock) return;

    setSaving(true);
    setError("");

    const parsedOrder = Number(editOrder);
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      setSaving(false);
      setError("A ordem deve ser um numero inteiro maior ou igual a zero.");
      return;
    }

    const response = await fetch(`/api/admin/form-blocks/${encodeURIComponent(editingBlock.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blockKey: editBlockKey.trim(),
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        order: parsedOrder,
        active: editActive,
      }),
    });

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao atualizar bloco.");
      return;
    }

    setEditingBlock(null);
    await reloadBlocks();
  };

  const onToggleBlock = async (block: BlockRow) => {
    setSaving(true);
    setError("");

    const response = await fetch(`/api/admin/form-blocks/${encodeURIComponent(block.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !block.active }),
    });

    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Falha ao atualizar estado do bloco.");
      return;
    }

    await reloadBlocks();
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
          <Link
            className="mt-3 inline-flex text-sm font-medium text-brand-600 hover:underline"
            href="/dashboard"
          >
            Voltar ao painel
          </Link>
        </AppCard>
      </AppShell>
    );
  }

  return (
    <AppShell active="admin">
      <PageHeader
        title="Questionarios"
        description="Gestao de blocos dos questionarios dinamicos por empresa."
        action={
          <Link className={btnSecondary} href="/admin/usuarios">
            Gerir usuarios
          </Link>
        }
      />

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {isSuperAdmin ? (
        <AppCard className="mb-6">
          <label className={labelClass}>
            Empresa
            <select
              className={inputClass}
              value={selectedCompanyId}
              onChange={(event) => void onChangeCompany(event.target.value)}
            >
              <option value="">Selecione uma empresa</option>
              {activeCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.slug})
                </option>
              ))}
            </select>
          </label>
        </AppCard>
      ) : null}

      <AppCard className="mb-6">
        <h2 className="text-sm font-semibold text-surface-900">Novo bloco</h2>
        <p className="mb-4 mt-0.5 text-xs text-surface-500">
          Defina a chave, titulo e ordem de exibicao do bloco.
        </p>

        <form onSubmit={onCreateBlock} className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Chave do bloco
            <input
              required
              className={inputClass}
              value={createBlockKey}
              onChange={(event) => setCreateBlockKey(event.target.value)}
              placeholder="ex: bloco22"
            />
          </label>
          <label className={labelClass}>
            Titulo
            <input
              required
              className={inputClass}
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="Titulo do bloco"
            />
          </label>
          <label className={labelClass}>
            Ordem
            <input
              required
              className={inputClass}
              type="number"
              min={0}
              step={1}
              value={createOrder}
              onChange={(event) => setCreateOrder(event.target.value)}
            />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Descricao (opcional)
            <textarea
              className={inputClass}
              rows={2}
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="Contexto ou orientacoes do bloco"
            />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              Criar bloco
            </button>
          </div>
        </form>
      </AppCard>

      <AppCard className="overflow-x-auto" padding="p-0 sm:p-0">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-200/90 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
              <th className="px-4 py-3">Ordem</th>
              <th className="px-4 py-3">Chave</th>
              <th className="px-4 py-3">Titulo</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Perguntas</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {blocks.map((block) => (
              <tr key={block.id} className="text-surface-800 transition hover:bg-brand-500/8">
                <td className="px-4 py-3 text-surface-700">{block.order}</td>
                <td className="px-4 py-3 font-mono text-xs text-surface-600">{block.blockKey}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{block.title}</div>
                  {block.description ? (
                    <p className="mt-0.5 max-w-xl text-xs text-surface-500">{block.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-surface-600">
                  {block.company ? `${block.company.name} (${block.company.slug})` : "-"}
                </td>
                <td className="px-4 py-3 text-surface-700">{block._count?.questions ?? 0}</td>
                <td className="px-4 py-3">
                  {block.active ? (
                    <span className="inline-flex rounded-md bg-emerald-100/90 px-2 py-0.5 text-xs font-medium text-emerald-900">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md bg-surface-200/90 px-2 py-0.5 text-xs font-medium text-surface-800">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/admin/questionarios/blocos/${encodeURIComponent(block.id)}/perguntas`}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Perguntas
                    </Link>
                    <button
                      type="button"
                      onClick={() => onOpenEditBlock(block)}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void onToggleBlock(block)}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      {block.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {blocks.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-surface-500" colSpan={7}>
                  Nenhum bloco encontrado para os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </AppCard>

      {editingBlock ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/50 p-4 backdrop-blur-[2px]"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-2xl border border-surface-200/90 bg-surface-0 p-5 shadow-2xl ring-1 ring-surface-950/10 sm:p-6">
            <h2 className="text-sm font-semibold text-surface-900">Editar bloco: {editingBlock.title}</h2>
            <form onSubmit={onUpdateBlock} className="mt-4 space-y-4">
              <label className={labelClass}>
                Chave do bloco
                <input
                  required
                  className={inputClass}
                  value={editBlockKey}
                  onChange={(event) => setEditBlockKey(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Titulo
                <input
                  required
                  className={inputClass}
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Ordem
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={editOrder}
                  onChange={(event) => setEditOrder(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Descricao (opcional)
                <textarea
                  rows={2}
                  className={inputClass}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-2.5 text-xs font-medium text-surface-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
                  checked={editActive}
                  onChange={(event) => setEditActive(event.target.checked)}
                />
                Bloco ativo
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button type="button" className={btnSecondary} onClick={() => setEditingBlock(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
