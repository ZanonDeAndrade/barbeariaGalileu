import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { getVapidConfig, isPushConfigured } from '../config/push.js';
import {
  deactivatePushSubscription,
  findSubscriptionByEndpoint,
  savePushSubscription,
} from '../services/pushService.js';
import { processDueReminders } from '../services/reminderService.js';
import {
  statusQuerySchema,
  subscribeBarberBodySchema,
  subscribeCustomerBodySchema,
  unsubscribeBodySchema,
} from '../schemas/push.schema.js';

function ensureConfigured() {
  if (!isPushConfigured()) {
    throw new HttpError(503, 'Notificacoes push nao estao configuradas no servidor', {
      code: 'PUSH_NOT_CONFIGURED',
    });
  }
}

export const getPublicKeyHandler = asyncHandler(async (_req: Request, res: Response) => {
  const vapid = getVapidConfig();
  if (!vapid) {
    throw new HttpError(503, 'Notificacoes push nao estao configuradas no servidor', {
      code: 'PUSH_NOT_CONFIGURED',
    });
  }

  res.json({ publicKey: vapid.publicKey });
});

export const subscribeCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  ensureConfigured();

  const { phone, subscription, userAgent } = subscribeCustomerBodySchema.parse(req.body ?? {});
  const normalizedPhone = normalizePhone(phone);

  if (normalizedPhone.length < 8) {
    throw new HttpError(400, 'Telefone invalido', { code: 'INVALID_PHONE' });
  }

  // Resolve o cliente pelo telefone (identidade do app). Nunca confiamos em um
  // customerId enviado pelo frontend — ele e derivado no servidor.
  const customer = await prisma.customer.upsert({
    where: { phone: normalizedPhone },
    update: {},
    create: { phone: normalizedPhone },
  });

  const saved = await savePushSubscription({
    userType: 'CUSTOMER',
    customerId: customer.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent ?? req.header('user-agent') ?? null,
  });

  res.status(201).json({ id: saved.id, isActive: saved.isActive });
});

export const subscribeBarberHandler = asyncHandler(async (req: Request, res: Response) => {
  ensureConfigured();

  const { subscription, userAgent } = subscribeBarberBodySchema.parse(req.body ?? {});

  const saved = await savePushSubscription({
    userType: 'BARBER',
    customerId: null,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent ?? req.header('user-agent') ?? null,
  });

  res.status(201).json({ id: saved.id, isActive: saved.isActive });
});

export const unsubscribeHandler = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint } = unsubscribeBodySchema.parse(req.body ?? {});
  await deactivatePushSubscription(endpoint);
  res.json({ ok: true });
});

export const getStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint } = statusQuerySchema.parse({ endpoint: req.query.endpoint });
  const subscription = await findSubscriptionByEndpoint(endpoint);

  res.json({
    configured: isPushConfigured(),
    subscribed: Boolean(subscription?.isActive),
  });
});

export const runRemindersHandler = asyncHandler(async (_req: Request, res: Response) => {
  // Sem VAPID nao ha como enviar; retorna 503 em vez de consumir os claims.
  ensureConfigured();
  const summary = await processDueReminders();
  res.json({ ok: true, summary });
});
