-- AlterEnum
ALTER TYPE "DraftKind" ADD VALUE 'CAMPAIGN_COPY';
ALTER TYPE "DraftKind" ADD VALUE 'BLOG_ARTICLE';
ALTER TYPE "DraftKind" ADD VALUE 'NEWSLETTER';
ALTER TYPE "DraftKind" ADD VALUE 'HEADLINE';
ALTER TYPE "DraftKind" ADD VALUE 'SEO_PAGE';

-- CreateEnum
CREATE TYPE "PlacementKind" AS ENUM ('NEW_HIRE', 'TRANSFER', 'RETURNING');

-- CreateEnum
CREATE TYPE "CareNeed" AS ENUM ('INFANT', 'NEWBORN', 'ELDERLY', 'DEMENTIA', 'DISABILITY', 'MULTIPLE_CHILDREN');

-- AlterTable
ALTER TABLE "Candidate"
ADD COLUMN "placementKind" "PlacementKind" NOT NULL DEFAULT 'NEW_HIRE',
ADD COLUMN "careNeeds" "CareNeed"[] NOT NULL DEFAULT ARRAY[]::"CareNeed"[],
ADD COLUMN "skillLevels" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "languageLevels" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Enquiry"
ADD COLUMN "source" TEXT NOT NULL DEFAULT '',
ADD COLUMN "utmSource" TEXT NOT NULL DEFAULT '',
ADD COLUMN "utmMedium" TEXT NOT NULL DEFAULT '',
ADD COLUMN "utmCampaign" TEXT NOT NULL DEFAULT '',
ADD COLUMN "utmContent" TEXT NOT NULL DEFAULT '',
ADD COLUMN "landingPath" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MarketingDraft"
ADD COLUMN "channel" TEXT NOT NULL DEFAULT '',
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "variantGroup" TEXT NOT NULL DEFAULT '',
ADD COLUMN "compliance" JSONB,
ADD COLUMN "campaignId" TEXT;

-- CreateTable
CREATE TABLE "AgencySetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "eaLicenceNo" TEXT NOT NULL DEFAULT '00C0000',
    "personnel" JSONB NOT NULL DEFAULT '[]',
    "brandVoice" TEXT NOT NULL DEFAULT '',
    "voiceNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT '',
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSlot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "draftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtmLink" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destinationPath" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtmLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestimonialRequest" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "prompt" TEXT NOT NULL DEFAULT '',
    "submittedText" TEXT NOT NULL DEFAULT '',
    "publishedQuote" TEXT NOT NULL DEFAULT '',
    "area" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "TestimonialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchWeightProfile" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchWeightProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "gaps" TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "suggestedWeights" JSONB,
    "appliedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TestimonialRequest_tokenHash_key" ON "TestimonialRequest"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MatchWeightProfile_requirementId_key" ON "MatchWeightProfile"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewFeedback_interviewId_key" ON "InterviewFeedback"("interviewId");

-- CreateIndex
CREATE INDEX "CampaignSlot_campaignId_scheduledFor_idx" ON "CampaignSlot"("campaignId", "scheduledFor");

-- CreateIndex
CREATE INDEX "AiUsageLog_feature_createdAt_idx" ON "AiUsageLog"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketingDraft" ADD CONSTRAINT "MarketingDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSlot" ADD CONSTRAINT "CampaignSlot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtmLink" ADD CONSTRAINT "UtmLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchWeightProfile" ADD CONSTRAINT "MatchWeightProfile_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "EmployerRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchWeightProfile" ADD CONSTRAINT "MatchWeightProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
