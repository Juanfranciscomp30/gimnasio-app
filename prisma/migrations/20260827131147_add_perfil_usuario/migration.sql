-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cancellationRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "profileImageUrl" TEXT;
