-- Personal-data markers on the existing billing tables, plus helper agency fees.
-- Amount columns are left in place. The retention job clears notes after the financial window.

ALTER TABLE "ServiceContract" ADD COLUMN "anonymisedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "anonymisedAt" TIMESTAMP(3);
ALTER TABLE "PaymentRecord" ADD COLUMN "anonymisedAt" TIMESTAMP(3);

CREATE INDEX "ServiceContract_createdAt_idx" ON "ServiceContract"("createdAt");
CREATE INDEX "ServiceContract_anonymisedAt_idx" ON "ServiceContract"("anonymisedAt");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE INDEX "Invoice_anonymisedAt_idx" ON "Invoice"("anonymisedAt");
CREATE INDEX "PaymentRecord_createdAt_idx" ON "PaymentRecord"("createdAt");
CREATE INDEX "PaymentRecord_anonymisedAt_idx" ON "PaymentRecord"("anonymisedAt");

CREATE TABLE "WorkerFee" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "contractId" TEXT,
    "monthlySalaryCents" INTEGER NOT NULL,
    "contractMonths" INTEGER NOT NULL,
    "workPassMonths" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymisedAt" TIMESTAMP(3),

    CONSTRAINT "WorkerFee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerFee_createdAt_idx" ON "WorkerFee"("createdAt");
CREATE INDEX "WorkerFee_candidateId_idx" ON "WorkerFee"("candidateId");
CREATE INDEX "WorkerFee_anonymisedAt_idx" ON "WorkerFee"("anonymisedAt");

ALTER TABLE "WorkerFee" ADD CONSTRAINT "WorkerFee_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkerFee" ADD CONSTRAINT "WorkerFee_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ServiceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
