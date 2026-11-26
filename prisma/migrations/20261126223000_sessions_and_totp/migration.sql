-- Revocable sessions and TOTP fields. Session secrets are stored only as hashes.

ALTER TABLE "User" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "totpPendingSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "totpLastStep" INTEGER;
ALTER TABLE "User" ADD COLUMN "totpSetupDueAt" TIMESTAMP(3);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecoveryCode_userId_codeHash_key" ON "RecoveryCode"("userId", "codeHash");
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
