import * as PrismaPkg from "@prisma/client";

// Some environments (especially when running via custom runners) may not load `.env` early enough.
// For local/dev, default to the repo SQLite file to avoid Prisma init failures.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  process.env.DATABASE_URL = "file:./dev.db";
}

const PrismaClientCtor = (PrismaPkg as { PrismaClient?: new () => unknown }).PrismaClient;

if (!PrismaClientCtor) {
  throw new Error("PrismaClient indisponivel no pacote @prisma/client.");
}

declare global {
  var __prisma__: unknown | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any =
  (global.__prisma__ as Record<string, unknown> | undefined) ?? new PrismaClientCtor();

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = db;
}
