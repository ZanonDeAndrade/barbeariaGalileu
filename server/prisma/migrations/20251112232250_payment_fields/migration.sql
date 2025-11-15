/*
  Warnings:

  - A unique constraint covering the columns `[mpPaymentId]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_mpPaymentId_key" ON "Appointment"("mpPaymentId");
