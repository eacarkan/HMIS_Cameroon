-- AlterTable
ALTER TABLE "StockReservation" ADD COLUMN     "isFefoOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideAt" TIMESTAMP(3),
ADD COLUMN     "overrideById" TEXT,
ADD COLUMN     "overrideReason" TEXT;
