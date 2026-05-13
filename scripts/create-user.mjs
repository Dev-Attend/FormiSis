import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Usage:
 *   node scripts/create-user.mjs --name gean --email gean@formsis.local --password geanteste123 --role COMERCIAL --company attend
 */

// Local/dev convenience: allow running without a .env file.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

function getArg(flag, fallback = undefined) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

async function main() {
  const name = getArg("--name");
  const email = getArg("--email");
  const password = getArg("--password");
  const role = getArg("--role", "COMERCIAL");
  const companySlug = getArg("--company", "attend");

  if (!name || !email || !password) {
    throw new Error("Missing args: --name, --email, --password are required.");
  }

  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) {
    throw new Error(`Company '${companySlug}' not found. Run: npm run db:seed`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: UserRole[role] ?? UserRole.COMERCIAL,
      passwordHash,
      active: true,
      companyId: company.id,
    },
    create: {
      name,
      email,
      role: UserRole[role] ?? UserRole.COMERCIAL,
      passwordHash,
      active: true,
      companyId: company.id,
    },
  });

  // Intentionally log to stdout for CLI UX (this script is for local ops).
  process.stdout.write(
    JSON.stringify(
      { id: user.id, email: user.email, role: user.role, companySlug: company.slug },
      null,
      2,
    ) + "\n",
  );
}

main()
  .catch((err) => {
    // Intentionally log to stderr for CLI UX (this script is for local ops).
    process.stderr.write(String(err?.stack ?? err) + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
