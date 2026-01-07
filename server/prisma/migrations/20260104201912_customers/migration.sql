-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- Backfill: normalize phones, create customers, link appointments.
UPDATE "Appointment"
SET "customerPhone" = regexp_replace("customerPhone", '\D', '', 'g')
WHERE "customerPhone" <> regexp_replace("customerPhone", '\D', '', 'g');

INSERT INTO "Customer" ("id", "phone", "createdAt", "updatedAt")
SELECT
  'cust_' || md5(phone) AS id,
  phone,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT regexp_replace("customerPhone", '\D', '', 'g') AS phone
  FROM "Appointment"
  WHERE regexp_replace("customerPhone", '\D', '', 'g') <> ''
) phones
ON CONFLICT ("phone") DO NOTHING;

UPDATE "Appointment" AS a
SET "customerId" = c."id"
FROM "Customer" AS c
WHERE
  a."customerId" IS NULL
  AND c."phone" = regexp_replace(a."customerPhone", '\D', '', 'g')
  AND regexp_replace(a."customerPhone", '\D', '', 'g') <> '';

-- CreateIndex
CREATE INDEX "Appointment_customerId_startTime_idx" ON "Appointment"("customerId", "startTime");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
