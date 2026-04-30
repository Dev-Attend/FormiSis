"use client";

import { AppShell } from "@/components/AppShell";
import { ProposalForm } from "@/components/ProposalForm";

export default function NovaPropostaPage() {
  return (
    <AppShell active="propostas">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-1 shrink-0">
          <h1 className="text-sm font-semibold text-surface-900">Nova proposta</h1>
          <p className="text-[11px] text-surface-500">Preencha os dados iniciais e inicie a proposta.</p>
        </div>
        <div className="-mx-2 min-h-0 flex-1 overflow-hidden border-y border-surface-200/80 bg-surface-0 sm:-mx-3 lg:-mx-4">
          <ProposalForm backHref="/propostas" newProposalDraft />
        </div>
      </div>
    </AppShell>
  );
}
