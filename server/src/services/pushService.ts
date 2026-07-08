import webPush from 'web-push';
import type { PushSubscription, PushUserType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getVapidConfig } from '../config/push.js';

export const PUSH_ICON_PATH = '/icons/icon-192.png';
export const PUSH_BADGE_PATH = '/icons/icon-192.png';

const PUSH_TTL_SECONDS = 60 * 60;
const GONE_STATUS_CODES = new Set([404, 410]);

// Teto de inscricoes ativas por usuario. O rate limit e no-op em producao
// (RATE_LIMIT_STORE=none no Cloud Run), entao este cap evita crescimento
// ilimitado de linhas por telefone/barbeiro. Alem do teto, as mais antigas
// sao desativadas.
const MAX_ACTIVE_SUBSCRIPTIONS_PER_USER = 20;

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  type?: string;
  appointmentId?: string;
}

export interface WebPushClient {
  sendNotification(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: string,
    options?: { TTL?: number },
  ): Promise<unknown>;
}

type PrismaLike = Pick<typeof prisma, 'pushSubscription'>;

export interface PushServiceDeps {
  prismaClient?: PrismaLike;
  webPushClient?: WebPushClient | null;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

let memoizedWebPushClient: WebPushClient | null = null;
let warnedMissingConfig = false;

function resolveWebPushClient(logger: Pick<Console, 'warn'>): WebPushClient | null {
  if (memoizedWebPushClient) {
    return memoizedWebPushClient;
  }

  const vapid = getVapidConfig();
  if (!vapid) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.warn(
        '[push] Web Push nao configurado. Defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.',
      );
    }
    return null;
  }

  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  memoizedWebPushClient = webPush;
  return memoizedWebPushClient;
}

export function truncateEndpointForLog(endpoint: string) {
  return endpoint.length > 48 ? `${endpoint.slice(0, 48)}...` : endpoint;
}

export interface SaveSubscriptionInput {
  userType: PushUserType;
  customerId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

async function enforceSubscriptionCap(
  saved: PushSubscription,
  prismaClient: PrismaLike,
  logger: Pick<Console, 'error'>,
) {
  try {
    const where =
      saved.userType === 'BARBER'
        ? { userType: 'BARBER' as const, isActive: true }
        : { userType: 'CUSTOMER' as const, customerId: saved.customerId, isActive: true };

    const active = await prismaClient.pushSubscription.findMany({ where });
    if (active.length <= MAX_ACTIVE_SUBSCRIPTIONS_PER_USER) {
      return;
    }

    const excess = active
      .filter((subscription) => subscription.endpoint !== saved.endpoint)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, active.length - MAX_ACTIVE_SUBSCRIPTIONS_PER_USER);

    for (const subscription of excess) {
      await prismaClient.pushSubscription.update({
        where: { endpoint: subscription.endpoint },
        data: { isActive: false },
      });
    }
  } catch (error) {
    logger.error('[push] falha ao aplicar teto de inscricoes por usuario', error);
  }
}

export async function savePushSubscription(
  input: SaveSubscriptionInput,
  deps: PushServiceDeps = {},
): Promise<PushSubscription> {
  const prismaClient = deps.prismaClient ?? prisma;
  const logger = deps.logger ?? console;

  const saved = await prismaClient.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      userType: input.userType,
      customerId: input.customerId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      isActive: true,
    },
    create: {
      userType: input.userType,
      customerId: input.customerId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      isActive: true,
    },
  });

  await enforceSubscriptionCap(saved, prismaClient, logger);

  return saved;
}

export async function findSubscriptionByEndpoint(
  endpoint: string,
  deps: PushServiceDeps = {},
): Promise<PushSubscription | null> {
  const prismaClient = deps.prismaClient ?? prisma;
  return prismaClient.pushSubscription.findUnique({ where: { endpoint } });
}

export async function deactivatePushSubscription(endpoint: string, deps: PushServiceDeps = {}) {
  const prismaClient = deps.prismaClient ?? prisma;

  const existing = await prismaClient.pushSubscription.findUnique({ where: { endpoint } });
  if (!existing) {
    return null;
  }

  if (!existing.isActive) {
    return existing;
  }

  return prismaClient.pushSubscription.update({
    where: { endpoint },
    data: { isActive: false },
  });
}

export async function listActiveBarberSubscriptions(
  deps: PushServiceDeps = {},
): Promise<PushSubscription[]> {
  const prismaClient = deps.prismaClient ?? prisma;
  return prismaClient.pushSubscription.findMany({
    where: { userType: 'BARBER', isActive: true },
  });
}

export async function listActiveCustomerSubscriptions(
  customerId: string,
  deps: PushServiceDeps = {},
): Promise<PushSubscription[]> {
  const prismaClient = deps.prismaClient ?? prisma;
  return prismaClient.pushSubscription.findMany({
    where: { userType: 'CUSTOMER', customerId, isActive: true },
  });
}

export interface PushSendSummary {
  attempted: number;
  sent: number;
  failed: number;
  deactivated: number;
}

export interface PushSendOptions {
  /** TTL da mensagem no serviço de push (segundos). Default: 1h. */
  ttlSeconds?: number;
}

function resolveTtlSeconds(options: PushSendOptions): number {
  const requested = options.ttlSeconds;
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return PUSH_TTL_SECONDS;
  }
  // Limita entre 0 e o teto padrão; lembretes passam o tempo restante ate o
  // atendimento para nao serem entregues depois que ja passou.
  return Math.max(0, Math.min(PUSH_TTL_SECONDS, Math.floor(requested)));
}

export async function sendPushToSubscriptions(
  subscriptions: PushSubscription[],
  payload: PushPayload,
  deps: PushServiceDeps = {},
  options: PushSendOptions = {},
): Promise<PushSendSummary> {
  const logger = deps.logger ?? console;
  const summary: PushSendSummary = {
    attempted: subscriptions.length,
    sent: 0,
    failed: 0,
    deactivated: 0,
  };

  if (subscriptions.length === 0) {
    return summary;
  }

  const webPushClient =
    deps.webPushClient !== undefined ? deps.webPushClient : resolveWebPushClient(logger);

  if (!webPushClient) {
    summary.failed = subscriptions.length;
    return summary;
  }

  const body = JSON.stringify({
    icon: PUSH_ICON_PATH,
    badge: PUSH_BADGE_PATH,
    ...payload,
  });
  const ttl = resolveTtlSeconds(options);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPushClient.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: ttl },
        );
        summary.sent += 1;
      } catch (error: any) {
        summary.failed += 1;
        const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : null;

        if (statusCode !== null && GONE_STATUS_CODES.has(statusCode)) {
          summary.deactivated += 1;
          try {
            await deactivatePushSubscription(subscription.endpoint, deps);
            logger.log(
              `[push] inscricao expirada desativada (${statusCode}): ${truncateEndpointForLog(subscription.endpoint)}`,
            );
          } catch (deactivateError) {
            logger.error('[push] falha ao desativar inscricao expirada', deactivateError);
          }
        } else {
          logger.error(
            `[push] falha ao enviar notificacao (${statusCode ?? 'sem status'}): ${truncateEndpointForLog(subscription.endpoint)}`,
            error?.message ?? error,
          );
        }
      }
    }),
  );

  return summary;
}

export async function sendPushToBarber(
  payload: PushPayload,
  deps: PushServiceDeps = {},
  options: PushSendOptions = {},
): Promise<PushSendSummary> {
  const subscriptions = await listActiveBarberSubscriptions(deps);
  return sendPushToSubscriptions(subscriptions, payload, deps, options);
}

export async function sendPushToCustomer(
  customerId: string,
  payload: PushPayload,
  deps: PushServiceDeps = {},
  options: PushSendOptions = {},
): Promise<PushSendSummary> {
  const subscriptions = await listActiveCustomerSubscriptions(customerId, deps);
  return sendPushToSubscriptions(subscriptions, payload, deps, options);
}

export function resetPushClientForTests() {
  memoizedWebPushClient = null;
  warnedMissingConfig = false;
}
