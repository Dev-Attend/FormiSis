"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AppCard } from "@/components/AppCard";
import { PageHeader } from "@/components/PageHeader";

type Submission = {
  id: string;
  internalName: string;
  generatedDoc: string;
  generatedAt: string;
  createdBy: string;
};

export default function SubmissoesPage() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/submissions");
      if (res.ok) {
        const payload = (await res.json()) as { submissions: Submission[] };
        setRows(payload.submissions);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell active="documentos">
      <PageHeader
        title="Documentos"
        description="Histórico de ficheiros DOCX/PDF gerados a partir das propostas."
      />

      <AppCard>
        {loading ? (
          <p className="text-sm text-surface-500">A carregar…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-surface-500">Nenhum documento nesta lista.</p>
        ) : (
          <div className="overflow-auto rounded-xl border border-surface-200/60">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200/90 bg-surface-50/80 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th className="px-3 py-3 sm:px-4">Nome interno</th>
                  <th className="px-3 py-3 sm:px-4">Documento</th>
                  <th className="px-3 py-3 sm:px-4">Criado por</th>
                  <th className="px-3 py-3 sm:px-4">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((row) => (
                  <tr key={row.id} className="text-surface-800 transition hover:bg-brand-500/8">
                    <td className="px-3 py-3 sm:px-4">{row.internalName}</td>
                    <td className="px-3 py-3 text-surface-600 sm:px-4">{row.generatedDoc}</td>
                    <td className="px-3 py-3 text-surface-600 sm:px-4">{row.createdBy}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-surface-500 sm:px-4">
                      {new Date(row.generatedAt).toLocaleString("pt-PT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
