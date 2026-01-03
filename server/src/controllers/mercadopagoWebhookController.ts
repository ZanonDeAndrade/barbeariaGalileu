import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  fetchMercadoPagoMerchantOrder,
  fetchMercadoPagoPayment,
  type MercadoPagoPayment,
} from '../services/mercadoPagoApi.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { markAppointmentPayment } from '../services/payments.service.js';

type Primitive = string | number | boolean | null;
type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

type PrismaLike = {
  appointment: {
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  webhookEvent: {
    create: (args: any) => Promise<any>;
  };
};

type MercadoPagoApi = {
  fetchPayment: (paymentId: string) => Promise<MercadoPagoPayment>;
  fetchMerchantOrder: (
    orderId: string,
  ) => Promise<{ payments: Array<{ id?: string; status?: string | null }> }>;
};

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return firstString(value[0]);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return undefined;
}

function sanitizeHeaders(headers: Request['headers']) {
  const allowed = [
    'x-request-id',
    'x-signature',
    'user-agent',
    'content-type',
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
  ];

  const sanitized: Record<string, Primitive> = {};
  for (const key of allowed) {
    const value = headers[key];
    sanitized[key] = typeof value === 'string' ? value : Array.isArray(value) ? value.join(',') : null;
  }
  return sanitized;
}

function sanitizeQuery(query: Request['query']) {
  const sanitized: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(query)) {
    const normalized = firstString(value);
    sanitized[key] = normalized ?? null;
  }
  return sanitized;
}

function sanitizeBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return {};
  }
  return body as Record<string, unknown>;
}

function pickMercadoPagoEventType(req: Request) {
  const query = req.query as Record<string, unknown>;
  const body = req.body as any;

  const type = firstString(query.type) ?? (typeof body?.type === 'string' ? body.type : undefined);
  const topic = firstString(query.topic) ?? (typeof body?.topic === 'string' ? body.topic : undefined);

  if (type === 'payment' || topic === 'payment') return 'payment';
  if (type === 'merchant_order' || topic === 'merchant_order') return 'merchant_order';
  return type ?? topic ?? 'unknown';
}

function extractPaymentIdFromRequest(req: Request): string | null {
  const query = req.query as Record<string, unknown>;
  const body = req.body as any;

  const fromQuery =
    firstString(query['data.id']) ??
    firstString(query['data[id]']) ??
    firstString(query['data_id']) ??
    firstString(query.id);

  const fromBody = firstString(body?.data?.id) ?? firstString(body?.id);

  const resource = firstString(query.resource) ?? firstString(body?.resource);
  const resourceMatch = resource?.match(/\/payments\/(\d+)/i);

  return fromQuery ?? fromBody ?? resourceMatch?.[1] ?? null;
}

function extractMerchantOrderIdFromRequest(req: Request): string | null {
  const query = req.query as Record<string, unknown>;
  const body = req.body as any;

  const fromQuery = firstString(query.id);
  const fromBody = firstString(body?.data?.id) ?? firstString(body?.id);
  const resource = firstString(query.resource) ?? firstString(body?.resource);
  const resourceMatch = resource?.match(/\/merchant_orders\/(\d+)/i);

  return fromQuery ?? fromBody ?? resourceMatch?.[1] ?? null;
}

function mapMercadoPagoStatus(status: string, statusDetail?: string | null) {
  if (status === 'approved' || statusDetail === 'accredited') {
    return 'approved' as const;
  }

  if (
    status === 'rejected' ||
    status === 'cancelled' ||
    status === 'refunded' ||
    status === 'charged_back'
  ) {
    return 'rejected' as const;
  }

  return 'pending' as const;
}

function resolveAppointmentId(payment: MercadoPagoPayment) {
  const metadata = payment.metadata as any;
  const metadataAppointmentId = metadata?.appointmentId ?? metadata?.appointment_id;

  if (typeof metadataAppointmentId === 'string' && metadataAppointmentId.trim()) {
    return metadataAppointmentId.trim();
  }

  if (
    typeof metadataAppointmentId === 'number' &&
    Number.isFinite(metadataAppointmentId) &&
    metadataAppointmentId > 0
  ) {
    return metadataAppointmentId.toString();
  }

  if (payment.external_reference && payment.external_reference.trim()) {
    return payment.external_reference.trim();
  }

  return null;
}

export function createMercadoPagoWebhookHandler(deps: {
  prismaClient?: PrismaLike;
  mpApi?: MercadoPagoApi;
  logger?: Logger;
} = {}) {
  const prismaClient = deps.prismaClient ?? (prisma as unknown as PrismaLike);
  const mpApi =
    deps.mpApi ??
    ({
      fetchPayment: fetchMercadoPagoPayment,
      fetchMerchantOrder: fetchMercadoPagoMerchantOrder,
    } satisfies MercadoPagoApi);
  const logger = deps.logger ?? console;

  const applyPaymentUpdate = async (payment: MercadoPagoPayment) => {
    const appointmentId = resolveAppointmentId(payment);
    const paymentId = payment.id?.toString();

    const appointment =
      (appointmentId
        ? await prismaClient.appointment.findUnique({ where: { id: appointmentId } })
        : null) ??
      (paymentId
        ? await prismaClient.appointment.findFirst({ where: { mpPaymentId: paymentId } })
        : null);

    if (!appointment) {
      return { appointment: null, appointmentId, paymentId };
    }

    const normalizedStatus = mapMercadoPagoStatus(payment.status, payment.status_detail ?? null);
    const method = payment.payment_method_id === 'pix' ? 'pix' : 'cartao';

    await markAppointmentPayment(
      appointment.id,
      {
        method,
        status: normalizedStatus,
        mpPaymentId: paymentId,
      },
      prismaClient as any,
    );

    const updated = await prismaClient.appointment.findUnique({ where: { id: appointment.id } });
    return { appointment: updated, appointmentId: appointment.id, paymentId };
  };

  return async function mercadoPagoWebhookHandler(req: Request, res: Response) {
    const requestId = randomUUID();
    const query = sanitizeQuery(req.query);
    const headers = sanitizeHeaders(req.headers);
    const body = sanitizeBody(req.body);
    const eventType = pickMercadoPagoEventType(req);

    const logPrefix = `[MP webhook] requestId=${requestId}`;
    logger.log(logPrefix, 'recebido', { method: req.method, path: req.path, query });

    const rawAction =
      typeof (req.body as any)?.action === 'string'
        ? (req.body as any).action
        : firstString((req.query as any).action);
    const baseAction = rawAction?.trim() ? rawAction.trim() : eventType;

    const finish = async (params: {
      processingStatus: 'SUCCESS' | 'FAILED' | 'IGNORED';
      eventAction: string;
      relatedProviderPaymentId?: string | null;
      errorMessage?: string | null;
    }) => {
      try {
        await prismaClient.webhookEvent.create({
          data: {
            provider: 'MERCADOPAGO',
            requestId,
            method: req.method,
            path: req.path,
            query,
            headers,
            body,
            eventType,
            eventAction: params.eventAction,
            relatedProviderPaymentId: params.relatedProviderPaymentId ?? null,
            processedAt: new Date(),
            processingStatus: params.processingStatus,
            errorMessage: params.errorMessage ?? null,
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          logger.warn(logPrefix, 'evento duplicado (idempotência)', {
            relatedProviderPaymentId: params.relatedProviderPaymentId ?? null,
            eventAction: params.eventAction,
          });
        } else {
          logger.error(logPrefix, 'falha ao registrar WebhookEvent', error);
        }
      }

      logger.log(logPrefix, 'respondendo 200', {
        processingStatus: params.processingStatus,
        relatedProviderPaymentId: params.relatedProviderPaymentId ?? null,
      });
      return res.status(200).json({ ok: true, requestId });
    };

    try {
      if (eventType === 'merchant_order') {
        const orderId = extractMerchantOrderIdFromRequest(req);
        if (!orderId) {
          return finish({
            processingStatus: 'FAILED',
            eventAction: `${baseAction}:missing_order_id`,
            errorMessage: 'merchant_order id ausente',
          });
        }

        const order = await mpApi.fetchMerchantOrder(orderId);
        const orderPaymentId =
          order.payments.find((item) => item.status === 'approved' && item.id)?.id ??
          order.payments.find((item) => item.id)?.id ??
          null;

        if (!orderPaymentId) {
          return finish({
            processingStatus: 'IGNORED',
            eventAction: `${baseAction}:no_payment`,
            relatedProviderPaymentId: null,
            errorMessage: `merchant_order ${orderId} sem pagamentos`,
          });
        }

        const payment = await mpApi.fetchPayment(orderPaymentId);
        const eventAction = `${baseAction}:${payment.status}${payment.status_detail ? `:${payment.status_detail}` : ''}`;

        const { appointment } = await applyPaymentUpdate(payment);

        if (!appointment) {
          return finish({
            processingStatus: 'FAILED',
            eventAction,
            relatedProviderPaymentId: payment.id,
            errorMessage: 'Agendamento não encontrado para este pagamento',
          });
        }

        return finish({
          processingStatus: 'SUCCESS',
          eventAction,
          relatedProviderPaymentId: payment.id,
        });
      }

      const paymentId = extractPaymentIdFromRequest(req);
      if (!paymentId) {
        return finish({
          processingStatus: 'FAILED',
          eventAction: `${baseAction}:missing_payment_id`,
          errorMessage: 'payment id ausente',
        });
      }

      const payment = await mpApi.fetchPayment(paymentId);
      const eventAction = `${baseAction}:${payment.status}${payment.status_detail ? `:${payment.status_detail}` : ''}`;

      const { appointment } = await applyPaymentUpdate(payment);

      if (!appointment) {
        return finish({
          processingStatus: 'FAILED',
          eventAction,
          relatedProviderPaymentId: payment.id,
          errorMessage: 'Agendamento não encontrado para este pagamento',
        });
      }

      return finish({
        processingStatus: 'SUCCESS',
        eventAction,
        relatedProviderPaymentId: payment.id,
      });
    } catch (error) {
      logger.error(logPrefix, 'erro ao processar webhook', error);
      return finish({
        processingStatus: 'FAILED',
        eventAction: `${baseAction}:processing_error`,
        errorMessage: (error as Error)?.message ?? 'Erro desconhecido',
      });
    }
  };
}

export const mercadoPagoWebhookHandler = createMercadoPagoWebhookHandler();

export function createMercadoPagoSyncHandler(deps: { prismaClient?: PrismaLike; mpApi?: MercadoPagoApi } = {}) {
  const prismaClient = deps.prismaClient ?? (prisma as unknown as PrismaLike);
  const mpApi =
    deps.mpApi ??
    ({
      fetchPayment: fetchMercadoPagoPayment,
      fetchMerchantOrder: fetchMercadoPagoMerchantOrder,
    } satisfies MercadoPagoApi);

  return async (req: Request, res: Response) => {
    const paramsSchema = z.object({
      paymentId: z.string().min(1),
    });

    const { paymentId } = paramsSchema.parse(req.params);
    const payment = await mpApi.fetchPayment(paymentId);

    const appointmentId = resolveAppointmentId(payment);
    const dbAppointment =
      (appointmentId
        ? await prismaClient.appointment.findUnique({ where: { id: appointmentId } })
        : null) ??
      (payment.id
        ? await prismaClient.appointment.findFirst({ where: { mpPaymentId: payment.id.toString() } })
        : null);

    if (!dbAppointment) {
      return res.status(404).json({ message: 'Agendamento não encontrado para este pagamento' });
    }

    const normalizedStatus = mapMercadoPagoStatus(payment.status, payment.status_detail ?? null);
    const method = payment.payment_method_id === 'pix' ? 'pix' : 'cartao';

    await markAppointmentPayment(
      dbAppointment.id,
      {
        method,
        status: normalizedStatus,
        mpPaymentId: payment.id.toString(),
      },
      prismaClient as any,
    );

    const updated = await prismaClient.appointment.findUnique({ where: { id: dbAppointment.id } });

    return res.json({
      status: 'ok',
      appointment: updated,
      mercadoPago: {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail ?? null,
      },
    });
  };
}

export const mercadoPagoSyncHandler = asyncHandler(createMercadoPagoSyncHandler());
