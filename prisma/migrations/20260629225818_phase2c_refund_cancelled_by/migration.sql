-- AlterTable
ALTER TABLE "RefundVoucher" ADD COLUMN     "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
