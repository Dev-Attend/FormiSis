-- Add ownerId to FormBlock with safe backfill (empresa + usuário dono).
-- Estratégia de backfill em cascata por empresa:
--   1) ADMIN/SUPER_ADMIN vinculado à empresa do bloco (mais antigo);
--   2) qualquer usuário vinculado à empresa (mais antigo);
--   3) SUPER_ADMIN global mais antigo.
-- Se ainda restar ownerId NULL, o RedefineTables abaixo falha (NOT NULL),
-- sinalizando dado órfão a tratar manualmente — nenhum dado é apagado.

ALTER TABLE "FormBlock" ADD COLUMN "ownerId" TEXT;

UPDATE "FormBlock"
SET "ownerId" = COALESCE(
  (
    SELECT uc."userId"
    FROM "UserCompany" uc
    JOIN "User" u ON u."id" = uc."userId"
    WHERE uc."companyId" = "FormBlock"."companyId"
      AND u."role" IN ('ADMIN', 'SUPER_ADMIN')
    ORDER BY u."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT uc2."userId"
    FROM "UserCompany" uc2
    WHERE uc2."companyId" = "FormBlock"."companyId"
    ORDER BY uc2."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT u3."id"
    FROM "User" u3
    WHERE u3."role" = 'SUPER_ADMIN'
    ORDER BY u3."createdAt" ASC
    LIMIT 1
  )
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FormBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormBlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FormBlock_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FormBlock" ("active", "blockKey", "companyId", "createdAt", "description", "id", "order", "ownerId", "title", "updatedAt") SELECT "active", "blockKey", "companyId", "createdAt", "description", "id", "order", "ownerId", "title", "updatedAt" FROM "FormBlock";
DROP TABLE "FormBlock";
ALTER TABLE "new_FormBlock" RENAME TO "FormBlock";
CREATE INDEX "FormBlock_companyId_ownerId_active_order_idx" ON "FormBlock"("companyId", "ownerId", "active", "order");
CREATE UNIQUE INDEX "FormBlock_companyId_ownerId_blockKey_key" ON "FormBlock"("companyId", "ownerId", "blockKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
