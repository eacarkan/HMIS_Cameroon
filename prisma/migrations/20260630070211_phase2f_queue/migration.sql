-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('waiting', 'in_service', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "QueueTicket" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "serviceUnitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "queueDate" DATE NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'waiting',
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueTicket_hospitalId_serviceUnitId_queueDate_status_idx" ON "QueueTicket"("hospitalId", "serviceUnitId", "queueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueTicket_hospitalId_serviceUnitId_queueDate_ticketNumber_key" ON "QueueTicket"("hospitalId", "serviceUnitId", "queueDate", "ticketNumber");

-- AddForeignKey
ALTER TABLE "QueueTicket" ADD CONSTRAINT "QueueTicket_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueTicket" ADD CONSTRAINT "QueueTicket_serviceUnitId_fkey" FOREIGN KEY ("serviceUnitId") REFERENCES "ServiceUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueTicket" ADD CONSTRAINT "QueueTicket_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
