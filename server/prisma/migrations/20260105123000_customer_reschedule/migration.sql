-- Add new statuses and cancellation roles
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "CancelledByRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "CancelledByRole" ADD VALUE IF NOT EXISTS 'CUSTOMER';

-- Reschedule metadata
ALTER TABLE "Appointment"
ADD COLUMN     "rescheduledFromId" TEXT,
ADD COLUMN     "rescheduledToId" TEXT;

-- Indexes to speed up history lookups
CREATE INDEX "Appointment_rescheduledFromId_idx" ON "Appointment"("rescheduledFromId");
CREATE INDEX "Appointment_rescheduledToId_idx" ON "Appointment"("rescheduledToId");

-- Self references to link rescheduled pairs
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledToId_fkey" FOREIGN KEY ("rescheduledToId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
