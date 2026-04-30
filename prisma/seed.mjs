import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email, name, role, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash, active: true },
    create: { email, name, role, passwordHash, active: true },
  });
}

async function main() {
  await upsertUser(
    process.env.FORMSIS_ADMIN_EMAIL ?? "admin@formsis.local",
    "Administrador",
    UserRole.ADMIN,
    process.env.FORMSIS_ADMIN_PASSWORD ?? "Admin@123",
  );

  await upsertUser(
    process.env.FORMSIS_USER_EMAIL ?? "usuario@formsis.local",
    "Usuario",
    UserRole.COMERCIAL,
    process.env.FORMSIS_USER_PASSWORD ?? "Usuario@123",
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
