-- Immutable actor id for the hash chain. The actorId foreign key is still
-- cleared when an account is deleted; actorRef is not, so verification survives.
ALTER TABLE "AuditLog" ADD COLUMN "actorRef" TEXT;
UPDATE "AuditLog" SET "actorRef" = "actorId" WHERE "actorRef" IS NULL AND "actorId" IS NOT NULL;
