"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProposalForm } from "@/components/ProposalForm";

export default function PropostaPorIdPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <AppShell active="propostas">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-1 shrink-0">
          <h1 className="text-sm font-semibold text-surface-900">Proposta</h1>
        </div>
        {id ? (
          <div className="-mx-2 min-h-0 flex-1 overflow-hidden border-y border-surface-200/80 bg-surface-0 sm:-mx-3 lg:-mx-4">
            <ProposalForm key={id} resumeProposalId={id} backHref="/propostas" />
          </div>
        ) : (
          <p className="text-sm text-surface-500">ID inválido.</p>
        )}
      </div>
    </AppShell>
  );
}
