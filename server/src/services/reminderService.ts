import type { Appointment } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  getBarberReminderMinutes,
  getCustomerReminderMinutes,
  getDayBeforeReminderMinutes,
  getReminderIntervalSeconds,
  isPushConfigured,
  isReminderSchedulerEnabled,
} from '../config/push.js';
import {
  buildBarberAppointmentUrl,
  buildCustomerAppointmentUrl,
  claimNotification,
  formatDayAndTime,
  formatDayPhrase,
  formatTimeShort,
  getHaircutDisplayName,
  type NotificationDeps,
} from './appointmentNotificationService.js';
import { sendPushToBarber, sendPushToCustomer, type PushSendSummary } from './pushService.js';

const MINUTE_MS = 60 * 1000;

type ReminderPrismaLike = Pick<typeof prisma, 'appointment' | 'notificationLog' | 'pushSubscription'>;

export interface ReminderDeps extends NotificationDeps {
  prismaClient?: ReminderPrismaLike;
  now?: Date;
}

export interface ReminderRunSummary {
  appointmentsInWindow: number;
  sent: number;
  skipped: number;
  failed: number;
  alreadyClaimed: number;
}

// Reassume claims PENDING abandonados (processo morto entre claim e envio)
// apos este tempo. Deve ser bem maior que a duracao de um envio.
const STALE_CLAIM_MS = 5 * 60 * 1000;

async function finishReminderLog(
  logId: string,
  summary: PushSendSummary,
  prismaClient: ReminderPrismaLike,
) {
  if (summary.sent > 0) {
    await prismaClient.notificationLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
    });
    return 'sent' as const;
  }

  // Sem envio (falha transitoria ou nenhuma inscricao ativa ainda): remove o
  // claim para que o lembrete seja re-tentado enquanto ainda estiver na janela.
  // Ex.: cliente que ativa o push apos a janela abrir ainda recebe a tempo.
  await prismaClient.notificationLog.delete({ where: { id: logId } });
  return summary.attempted === 0 ? ('skipped' as const) : ('failed' as const);
}

async function markClaimSkipped(logId: string, reason: string, prismaClient: ReminderPrismaLike) {
  await prismaClient.notificationLog.update({
    where: { id: logId },
    data: { status: 'SKIPPED', errorMessage: reason },
  });
}

interface ReminderKind {
  type: 'REMINDER_UPCOMING' | 'REMINDER_DAY_BEFORE';
  recipientType: 'BARBER' | 'CUSTOMER';
  leadMinutes: number;
  // Se, ao abrir a janela, ja tiver passado mais que isto, o lembrete e
  // ignorado (evita disparo tardio/incorreto apos indisponibilidade do
  // servidor). undefined = sem limite superior.
  maxLatenessMinutes?: number;
}

function buildReminderKinds(): ReminderKind[] {
  const customerLead = getCustomerReminderMinutes();
  const dayBeforeLead = getDayBeforeReminderMinutes();

  return [
    { type: 'REMINDER_UPCOMING', recipientType: 'BARBER', leadMinutes: getBarberReminderMinutes() },
    {
      type: 'REMINDER_UPCOMING',
      recipientType: 'CUSTOMER',
      leadMinutes: customerLead,
    },
    {
      type: 'REMINDER_DAY_BEFORE',
      recipientType: 'CUSTOMER',
      leadMinutes: dayBeforeLead,
      // So faz sentido enquanto ainda faltar mais que a antecedencia do
      // lembrete "proximo" — depois disso o lembrete de proximidade cobre.
      maxLatenessMinutes: Math.max(0, dayBeforeLead - customerLead),
    },
  ];
}

function buildReminderPayload(appointment: Appointment, kind: ReminderKind, now: Date) {
  const serviceName = getHaircutDisplayName(appointment.haircutType);
  const time = formatTimeShort(appointment.startTime);
  const tag = `appointment-${appointment.id}`;

  if (kind.recipientType === 'BARBER') {
    const minutesLeft = Math.max(1, Math.round((appointment.startTime.getTime() - now.getTime()) / MINUTE_MS));
    return {
      title: `Próximo atendimento em ${minutesLeft} min`,
      body: `${appointment.customerName} — ${serviceName} às ${time}.`,
      url: buildBarberAppointmentUrl(appointment),
      tag,
      type: kind.type,
      appointmentId: appointment.id,
    };
  }

  if (kind.type === 'REMINDER_DAY_BEFORE') {
    const dayPhrase = formatDayPhrase(appointment.startTime, now);
    const isTomorrow = dayPhrase === 'amanhã';
    return {
      title: isTomorrow ? 'Você tem um horário amanhã' : 'Lembrete de agendamento',
      body: `Seu atendimento de ${serviceName} será ${dayPhrase} às ${time}.`,
      url: buildCustomerAppointmentUrl(appointment),
      tag,
      type: kind.type,
      appointmentId: appointment.id,
    };
  }

  return {
    title: 'Seu atendimento está próximo',
    body: `Seu horário de ${serviceName} começa ${formatDayAndTime(appointment.startTime, now)}.`,
    url: buildCustomerAppointmentUrl(appointment),
    tag,
    type: kind.type,
    appointmentId: appointment.id,
  };
}

/**
 * Processa lembretes pendentes. Idempotente e seguro para rodar em mais de
 * uma instancia ao mesmo tempo: a unique (appointmentId, recipientType, type)
 * do NotificationLog funciona como trava distribuida.
 */
export async function processDueReminders(deps: ReminderDeps = {}): Promise<ReminderRunSummary> {
  const prismaClient = deps.prismaClient ?? prisma;
  const logger = deps.logger ?? console;
  const now = deps.now ?? new Date();

  const summary: ReminderRunSummary = {
    appointmentsInWindow: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    alreadyClaimed: 0,
  };

  // Nao consome (queima) claims quando o push nao pode ser enviado. Testes
  // injetam webPushClient; em producao depende das chaves VAPID.
  const canSend =
    deps.webPushClient !== undefined ? deps.webPushClient !== null : isPushConfigured();
  if (!canSend) {
    logger.warn('[reminders] push nao configurado; execucao ignorada (nenhum lembrete consumido)');
    return summary;
  }

  const kinds = buildReminderKinds();
  const maxLeadMinutes = Math.max(...kinds.map((kind) => kind.leadMinutes));

  const appointments = await prismaClient.appointment.findMany({
    where: {
      startTime: {
        gt: now,
        lte: new Date(now.getTime() + maxLeadMinutes * MINUTE_MS),
      },
      status: {
        in: ['SCHEDULED', 'CONFIRMED'],
      },
    },
    orderBy: { startTime: 'asc' },
  });

  summary.appointmentsInWindow = appointments.length;

  for (const appointment of appointments) {
    for (const kind of kinds) {
      if (kind.recipientType === 'CUSTOMER' && !appointment.customerId) {
        continue;
      }

      const windowOpensAt = new Date(
        appointment.startTime.getTime() - kind.leadMinutes * MINUTE_MS,
      );

      if (now < windowOpensAt) {
        continue;
      }

      // Muito atrasado (ex.: servidor esteve indisponivel): ignora sem
      // consumir claim — evita disparo tardio/incorreto e duplicado com o
      // lembrete de proximidade.
      if (
        kind.maxLatenessMinutes !== undefined &&
        now.getTime() - windowOpensAt.getTime() > kind.maxLatenessMinutes * MINUTE_MS
      ) {
        continue;
      }

      try {
        const log = await claimNotification(
          {
            appointmentId: appointment.id,
            recipientType: kind.recipientType,
            customerId: kind.recipientType === 'CUSTOMER' ? appointment.customerId : null,
            type: kind.type,
          },
          deps,
          { retryStaleAfterMs: STALE_CLAIM_MS },
        );

        if (!log) {
          summary.alreadyClaimed += 1;
          continue;
        }

        // Agendamento criado dentro da janela do lembrete: o destinatario
        // acabou de receber a confirmacao/aviso de novo agendamento.
        if (appointment.createdAt > windowOpensAt) {
          await markClaimSkipped(log.id, 'Agendamento criado dentro da janela do lembrete', prismaClient);
          summary.skipped += 1;
          continue;
        }

        const ttlSeconds = Math.max(
          1,
          Math.floor((appointment.startTime.getTime() - now.getTime()) / 1000),
        );
        const payload = buildReminderPayload(appointment, kind, now);
        const sendSummary =
          kind.recipientType === 'BARBER'
            ? await sendPushToBarber(payload, deps, { ttlSeconds })
            : await sendPushToCustomer(appointment.customerId as string, payload, deps, { ttlSeconds });

        const outcome = await finishReminderLog(log.id, sendSummary, prismaClient);
        summary[outcome] += 1;
      } catch (error) {
        summary.failed += 1;
        logger.error(
          `[reminders] falha ao processar lembrete ${kind.type}/${kind.recipientType} do agendamento ${appointment.id}`,
          error,
        );
      }
    }
  }

  return summary;
}

let reminderTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Inicia a rotina recorrente de lembretes no proprio processo do servidor.
 * Controlada por PUSH_REMINDERS_ENABLED e PUSH_REMINDER_INTERVAL_SECONDS.
 */
export function startReminderScheduler(deps: ReminderDeps = {}) {
  const logger = deps.logger ?? console;

  if (reminderTimer) {
    return reminderTimer;
  }

  if (!isReminderSchedulerEnabled()) {
    logger.log('[reminders] rotina de lembretes desabilitada (PUSH_REMINDERS_ENABLED=false)');
    return null;
  }

  if (!isPushConfigured()) {
    logger.warn(
      '[reminders] rotina de lembretes nao iniciada: chaves VAPID ausentes. Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.',
    );
    return null;
  }

  const intervalMs = getReminderIntervalSeconds() * 1000;

  const run = async () => {
    if (isRunning) {
      return;
    }
    isRunning = true;
    try {
      const result = await processDueReminders(deps);
      if (result.sent > 0 || result.failed > 0) {
        logger.log(
          `[reminders] execucao concluida: ${result.sent} enviado(s), ${result.skipped} pulado(s), ${result.failed} falha(s)`,
        );
      }
    } catch (error) {
      logger.error('[reminders] falha na execucao da rotina de lembretes', error);
    } finally {
      isRunning = false;
    }
  };

  reminderTimer = setInterval(() => {
    void run();
  }, intervalMs);
  reminderTimer.unref();

  void run();

  logger.log(`[reminders] rotina de lembretes iniciada (intervalo de ${intervalMs / 1000}s)`);
  return reminderTimer;
}

export function stopReminderScheduler() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}
