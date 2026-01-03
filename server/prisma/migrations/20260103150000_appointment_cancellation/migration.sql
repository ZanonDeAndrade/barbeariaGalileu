/*
  Adds appointment status + cancellation metadata and replaces the unique constraint on startTime
  with a partial unique index that ignores CANCELLED rows (so cancelled slots can be rebooked).
*/

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancelledByRole" AS ENUM ('BARBER');

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN     "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByRole" "CancelledByRole",
ADD COLUMN     "cancelReason" TEXT;

-- DropIndex
DROP INDEX "Appointment_startTime_key";

-- CreateIndex
CREATE INDEX "Appointment_status_startTime_idx" ON "Appointment"("status", "startTime");

-- CreateIndex (partial unique): only one active appointment per startTime
CREATE UNIQUE INDEX "Appointment_startTime_active_key"
ON "Appointment"("startTime")
WHERE "status" <> 'CANCELLED';

