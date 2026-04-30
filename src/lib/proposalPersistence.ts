import type { UserRole } from "@/lib/auth";

export type SessionListItem = {
  id: string;
  title: string;
  status: string;
  clientName: string | null;
  opportunityRef: string | null;
  revision: number;
  updatedAt: Date;
  startedAt: Date;
  finalizedAt: Date | null;
  createdById: string;
  creatorName?: string;
  creatorEmail?: string;
};

export function canManageProposal(role: UserRole, ownerId: string, userId: string) {
  if (role === "ADMIN" || role === "PRE_VENDAS") return true;
  return ownerId === userId;
}

export function canViewProposal(role: UserRole, ownerId: string, userId: string) {
  if (role === "ADMIN" || role === "PRE_VENDAS" || role === "LEITURA") return true;
  return ownerId === userId;
}
