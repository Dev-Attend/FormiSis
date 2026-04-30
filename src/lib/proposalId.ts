import { db } from "@/lib/db";

/**Prefixo curto, legivel em e-mail e PABX (evita 0/O, 1/I). */
const PREFIX = "PRP-";
/** ~35 bits de entropia; re-tentativas se colidir (extremamente raro). */
const BODY_LEN = 7;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomBody(): string {
  const bytes = new Uint8Array(BODY_LEN);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < BODY_LEN; i++) {
    s += ALPHABET[bytes[i]! % ALPHABET.length]!;
  }
  return s;
}

/**
 * Gera identificador unico, curto, para FormSession.
 * Ex.: `PRP-K4M8N2P` (11 caracteres) em vez de `prp_` + 32 hex do UUID.
 */
export async function allocateUniqueProposalId(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = PREFIX + randomBody();
    const existing = await db.formSession.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return id;
  }
  throw new Error("Não foi possível gerar ID de proposta único. Tente novamente.");
}
