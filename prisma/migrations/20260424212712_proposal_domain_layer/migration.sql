-- CreateTable
CREATE TABLE "ProposalRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalRevision_formSessionId_fkey" FOREIGN KEY ("formSessionId") REFERENCES "FormSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProposalRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "detailsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT,
    "formSessionId" TEXT,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_formSessionId_fkey" FOREIGN KEY ("formSessionId") REFERENCES "FormSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "detailsJson", "id", "resourceId", "resourceType", "submissionId", "userId") SELECT "action", "createdAt", "detailsJson", "id", "resourceId", "resourceType", "submissionId", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_formSessionId_createdAt_idx" ON "AuditLog"("formSessionId", "createdAt");
CREATE TABLE "new_FormSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "clientName" TEXT,
    "opportunityRef" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "payloadJson" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finalizedAt" DATETIME,
    "finalDocument" TEXT,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "FormSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FormSession" ("createdById", "finalDocument", "finalizedAt", "id", "payloadJson", "startedAt", "status", "title", "updatedAt", "warningsJson") SELECT "createdById", "finalDocument", "finalizedAt", "id", "payloadJson", "startedAt", "status", "title", "updatedAt", "warningsJson" FROM "FormSession";
DROP TABLE "FormSession";
ALTER TABLE "new_FormSession" RENAME TO "FormSession";
CREATE INDEX "FormSession_createdById_updatedAt_idx" ON "FormSession"("createdById", "updatedAt");
CREATE INDEX "FormSession_status_updatedAt_idx" ON "FormSession"("status", "updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProposalRevision_formSessionId_createdAt_idx" ON "ProposalRevision"("formSessionId", "createdAt");
