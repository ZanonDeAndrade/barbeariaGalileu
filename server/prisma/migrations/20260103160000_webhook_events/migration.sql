/*
  Webhook audit table for provider events (Mercado Pago).
*/

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('MERCADOPAGO');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('SUCCESS', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "requestId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAction" TEXT NOT NULL,
    "relatedProviderPaymentId" TEXT,
    "processedAt" TIMESTAMP(3),
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'FAILED',
    "errorMessage" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_requestId_key" ON "WebhookEvent"("requestId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_receivedAt_idx" ON "WebhookEvent"("provider", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_relatedProviderPaymentId_idx" ON "WebhookEvent"("relatedProviderPaymentId");

-- CreateIndex (idempotency)
CREATE UNIQUE INDEX "WebhookEvent_provider_relatedProviderPaymentId_eventAction_key"
ON "WebhookEvent"("provider", "relatedProviderPaymentId", "eventAction");

