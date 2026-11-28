-- Data-subject rights, AI budget ledger, and a tamper-evident audit chain.
-- marketingConsent starts equal to photoConsent so the public gallery does not empty on deploy.
-- aiProcessingConsent stays false until a person opts in.

ALTER TABLE "Candidate" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Candidate" ADD COLUMN "aiProcessingConsent" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Candidate" SET "marketingConsent" = "photoConsent";

ALTER TABLE "Employer" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employer" ADD COLUMN "aiProcessingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employer" ADD COLUMN "redactedAt" TIMESTAMP(3);

CREATE INDEX "Document_employerId_idx" ON "Document"("employerId");

ALTER TABLE "AuditLog" ADD COLUMN "seq" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "prevHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "rowHash" TEXT;
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");
CREATE INDEX "AuditLog_actorId_action_createdAt_idx" ON "AuditLog"("actorId", "action", "createdAt");

ALTER TABLE "AiUsageLog" ADD COLUMN "estimatedCostMicro" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageLog" ADD COLUMN "actorId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "DeletionOutbox" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeletionOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeletionOutbox_status_nextAttemptAt_idx" ON "DeletionOutbox"("status", "nextAttemptAt");

CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAssignment_staffId_candidateId_key" ON "StaffAssignment"("staffId", "candidateId");
CREATE INDEX "StaffAssignment_candidateId_idx" ON "StaffAssignment"("candidateId");

ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuditChainHead" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "rowHash" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChainHead_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AuditChainHead" ("id", "seq", "rowHash", "updatedAt") VALUES ('head', 0, '', CURRENT_TIMESTAMP);

CREATE TABLE "AuditCheckpoint" (
    "id" TEXT NOT NULL,
    "throughSeq" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditCheckpoint_throughSeq_idx" ON "AuditCheckpoint"("throughSeq");

CREATE TABLE "AiDailyLedger" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "reservedMicro" INTEGER NOT NULL DEFAULT 0,
    "spentMicro" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiDailyLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiDailyLedger_day_scope_key" ON "AiDailyLedger"("day", "scope");
CREATE INDEX "AiDailyLedger_day_idx" ON "AiDailyLedger"("day");

CREATE TABLE "AiReservation" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reservedMicro" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiReservation_day_status_idx" ON "AiReservation"("day", "status");

CREATE TABLE "EmbeddingCache" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmbeddingCache_contentHash_model_key" ON "EmbeddingCache"("contentHash", "model");
CREATE INDEX "EmbeddingCache_createdAt_idx" ON "EmbeddingCache"("createdAt");
