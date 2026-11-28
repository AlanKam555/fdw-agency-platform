-- Reminder delivery, holiday adjustments, MOM rule review, and placement outcomes.
-- Delivery rows store a hash of the recipient, not the address.

ALTER TABLE "Reminder" ADD COLUMN "kind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Reminder" ADD COLUMN "dueOn" TIMESTAMP(3);
ALTER TABLE "Reminder" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Reminder" ADD COLUMN "approvedById" TEXT;

CREATE INDEX "Reminder_kind_dueOn_idx" ON "Reminder"("kind", "dueOn");

CREATE TABLE "ReminderTypeOptIn" (
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderTypeOptIn_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "reminderId" TEXT,
    "kind" TEXT NOT NULL,
    "dueOn" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderDelivery_dedupeKey_key" ON "ReminderDelivery"("dedupeKey");
CREATE INDEX "ReminderDelivery_kind_createdAt_idx" ON "ReminderDelivery"("kind", "createdAt");

ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSuppression_emailHash_key" ON "EmailSuppression"("emailHash");

CREATE TABLE "PublicHolidayAdjustment" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicHolidayAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicHolidayAdjustment_date_key" ON "PublicHolidayAdjustment"("date");

CREATE TABLE "MomRuleState" (
    "key" TEXT NOT NULL,
    "overrideJson" TEXT,
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MomRuleState_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "PlacementOutcome" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "candidateId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "startedOn" TIMESTAMP(3) NOT NULL,
    "endedOn" TIMESTAMP(3),
    "checkInMonth" INTEGER,
    "durationDays" INTEGER NOT NULL,
    "completion" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL DEFAULT '',
    "employerSatisfaction" INTEGER NOT NULL,
    "helperSatisfaction" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementOutcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlacementOutcome_candidateId_idx" ON "PlacementOutcome"("candidateId");
CREATE INDEX "PlacementOutcome_employerId_idx" ON "PlacementOutcome"("employerId");
CREATE INDEX "PlacementOutcome_matchId_idx" ON "PlacementOutcome"("matchId");

ALTER TABLE "PlacementOutcome" ADD CONSTRAINT "PlacementOutcome_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlacementOutcome" ADD CONSTRAINT "PlacementOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementOutcome" ADD CONSTRAINT "PlacementOutcome_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
