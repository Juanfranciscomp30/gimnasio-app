-- CreateEnum
CREATE TYPE "AiPlanKind" AS ENUM ('TRAINING', 'NUTRITION');

-- CreateTable
CREATE TABLE "FitnessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "minutesPerSession" INTEGER NOT NULL DEFAULT 60,
    "trainsAtHome" BOOLEAN NOT NULL DEFAULT false,
    "dietPreference" TEXT,
    "limitations" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitnessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AiPlanKind" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReport" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FitnessProfile_userId_key" ON "FitnessProfile"("userId");

-- CreateIndex
CREATE INDEX "AiPlan_userId_kind_createdAt_idx" ON "AiPlan"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiReport_kind_createdAt_idx" ON "AiReport"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "FitnessProfile" ADD CONSTRAINT "FitnessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPlan" ADD CONSTRAINT "AiPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
