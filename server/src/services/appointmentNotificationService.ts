import type { Appointment, NotificationType, PushUserType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { getHaircutById } from './haircutService.js';
import { toBrazilDateTime, toBrazilCalendarDate } from '../utils/dateTime.js';
import {
  sendPushToBarber,
  sendPushToCustomer,
  type PushPayload,
  type PushSendSummary,
  type WebPushClient,
} from './pushService.js';

type PrismaLike = Pick<typeof prisma, 'notificationLog' | 'pushSubscription'>;

export interface NotificationDeps {
  prismaClient?: PrismaLike;
  webPushClient?: WebPushClient | null;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export function formatTimeShort(date: Date) {
  const zoned = toBrazilDateTime(date);
  return zoned.minute === 0 ? `${zoned.hour}h` : `${zoned.hour}h${String(zoned.minute).padStart(2, '0')}`;
}

export function formatDayPhrase(date: Date, now: Date = new Date()) {
  const zonedTarget = toBrazilDateTime(date).startOf('day');
  const zonedToday = toBrazilDateTime(now).startOf('day');
  const diffDays = zonedTarget.diff(zonedToday, 'days').days;

  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'amanhã';
  return toBrazilCalendarDate(date);
}

export function formatDayAndTime(date: Date, now: Date = new Date()) {
  return `${formatDayPhrase(date, now)} às ${formatTimeShort(date)}`;
}

export function getHaircutDisplayName(haircutType: string) {
  return getHaircutById(haircutType)?.name ?? haircutType;
}

export function buildBarberAppointmentUrl(appointment: Pick<Appointment, 'id' | 'startTime'>) {
  const date = toBrazilDateTime(appointment.startTime).toFormat('yyyy-MM-dd');
  return `/?date=${date}&appointmentId=${appointment.id}`;
}

export function buildCustomerAppointmentUrl(appointment: Pick<Appointment, 'id'>) {
  return `/?view=my-appointments&appointmentId=${appointment.id}`;
}

/**
 * Registra a intencao de envio no NotificationLog usando a unique
 * (appointmentId, recipientType, type) como trava de idempotencia.
 * Retorna null quando outra instancia ja registrou o mesmo envio.
 *
 * options.retryStaleAfterMs: quando definido, permite reassumir um claim
 * PENDING antigo (processo anterior morreu entre o claim e o envio). A
 * retomada e atomica via updateMany com guarda em createdAt, entao duas
 * instancias nunca reassumem o mesmo claim simultaneamente.
 */
export async function claimNotification(
  params: {
    appointmentId: string;
    recipientType: PushUserType;
    customerId: string | null;
    type: NotificationType;
  },
  deps: NotificationDeps = {},
  options: { retryStaleAfterMs?: number } = {},
) {
  const prismaClient = deps.prismaClient ?? prisma;

  try {
    return await prismaClient.notificationLog.create({
      data: {
        appointmentId: params.appointmentId,
        recipientType: params.recipientType,
        customerId: params.customerId,
        type: params.type,
        status: 'PENDING',
      },
    });
  } catch (error: any) {
    if (error?.code !== 'P2002') {
      throw error;
    }

    if (!options.retryStaleAfterMs) {
      return null;
    }

    const cutoff = new Date(Date.now() - options.retryStaleAfterMs);
    const takenOver = await prismaClient.notificationLog.updateMany({
      where: {
        appointmentId: params.appointmentId,
        recipientType: params.recipientType,
        type: params.type,
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      data: { createdAt: new Date() },
    });

    if (takenOver.count !== 1) {
      return null;
    }

    return prismaClient.notificationLog.findFirst({
      where: {
        appointmentId: params.appointmentId,
        recipientType: params.recipientType,
        type: params.type,
      },
    });
  }
}

async function finishNotification(
  logId: string,
  summary: PushSendSummary,
  deps: NotificationDeps = {},
) {
  const prismaClient = deps.prismaClient ?? prisma;

  if (summary.attempted === 0) {
    await prismaClient.notificationLog.update({
      where: { id: logId },
      data: { status: 'SKIPPED', errorMessage: 'Nenhuma inscricao push ativa para o destinatario' },
    });
    return;
  }

  if (summary.sent > 0) {
    await prismaClient.notificationLog.update({
      where: { id: logId },
      data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
    });
    return;
  }

  await prismaClient.notificationLog.update({
    where: { id: logId },
    data: {
      status: 'FAILED',
      errorMessage: `Falha ao enviar para ${summary.failed} inscricao(oes)`,
    },
  });
}

export async function dispatchToBarber(
  appointment: Pick<Appointment, 'id'>,
  type: NotificationType,
  payload: PushPayload,
  deps: NotificationDeps = {},
) {
  const log = await claimNotification(
    {
      appointmentId: appointment.id,
      recipientType: 'BARBER',
      customerId: null,
      type,
    },
    deps,
  );

  if (!log) {
    return null;
  }

  const summary = await sendPushToBarber(payload, deps);
  await finishNotification(log.id, summary, deps);
  return summary;
}

export async function dispatchToCustomer(
  appointment: Pick<Appointment, 'id' | 'customerId'>,
  type: NotificationType,
  payload: PushPayload,
  deps: NotificationDeps = {},
) {
  if (!appointment.customerId) {
    return null;
  }

  const log = await claimNotification(
    {
      appointmentId: appointment.id,
      recipientType: 'CUSTOMER',
      customerId: appointment.customerId,
      type,
    },
    deps,
  );

  if (!log) {
    return null;
  }

  const summary = await sendPushToCustomer(appointment.customerId, payload, deps);
  await finishNotification(log.id, summary, deps);
  return summary;
}

/**
 * Novo agendamento: avisa o barbeiro e confirma para o cliente.
 * Nunca lanca erro — falha de push nao pode desfazer o agendamento.
 */
export async function notifyNewAppointment(appointment: Appointment, deps: NotificationDeps = {}) {
  const logger = deps.logger ?? console;
  const serviceName = getHaircutDisplayName(appointment.haircutType);
  const when = formatDayAndTime(appointment.startTime);

  try {
    await dispatchToBarber(
      appointment,
      'NEW_APPOINTMENT',
      {
        title: 'Novo agendamento',
        body: `${appointment.customerName} agendou ${serviceName} para ${when}.`,
        url: buildBarberAppointmentUrl(appointment),
        tag: `appointment-${appointment.id}`,
        type: 'NEW_APPOINTMENT',
        appointmentId: appointment.id,
      },
      deps,
    );
  } catch (error) {
    logger.error('[push] falha ao notificar barbeiro sobre novo agendamento', error);
  }

  try {
    await dispatchToCustomer(
      appointment,
      'NEW_APPOINTMENT',
      {
        title: 'Agendamento confirmado',
        body: `Seu horário de ${serviceName} foi marcado para ${when}.`,
        url: buildCustomerAppointmentUrl(appointment),
        tag: `appointment-${appointment.id}`,
        type: 'NEW_APPOINTMENT',
        appointmentId: appointment.id,
      },
      deps,
    );
  } catch (error) {
    logger.error('[push] falha ao enviar confirmacao ao cliente', error);
  }
}

/**
 * Cancelamento: notifica a outra parte envolvida.
 * Cliente cancelou -> barbeiro. Barbeiro/admin cancelou -> cliente.
 */
export async function notifyAppointmentCancelled(
  appointment: Appointment,
  deps: NotificationDeps = {},
) {
  const logger = deps.logger ?? console;
  const serviceName = getHaircutDisplayName(appointment.haircutType);
  const when = formatDayAndTime(appointment.startTime);

  try {
    if (appointment.cancelledByRole === 'CUSTOMER') {
      await dispatchToBarber(
        appointment,
        'APPOINTMENT_CANCELLED',
        {
          title: 'Agendamento cancelado',
          body: `${appointment.customerName} cancelou o horário de ${when} (${serviceName}).`,
          url: buildBarberAppointmentUrl(appointment),
          tag: `appointment-${appointment.id}`,
          type: 'APPOINTMENT_CANCELLED',
          appointmentId: appointment.id,
        },
        deps,
      );
      return;
    }

    await dispatchToCustomer(
      appointment,
      'APPOINTMENT_CANCELLED',
      {
        title: 'Seu agendamento foi cancelado',
        body: `Seu horário de ${when} foi cancelado pela barbearia.`,
        url: buildCustomerAppointmentUrl(appointment),
        tag: `appointment-${appointment.id}`,
        type: 'APPOINTMENT_CANCELLED',
        appointmentId: appointment.id,
      },
      deps,
    );
  } catch (error) {
    logger.error('[push] falha ao notificar cancelamento', error);
  }
}

/**
 * Reagendamento (feito pelo cliente): notifica o barbeiro com o horario
 * antigo e o novo. O log fica vinculado ao novo agendamento.
 */
export async function notifyAppointmentRescheduled(
  params: { oldAppointment: Appointment; newAppointment: Appointment },
  deps: NotificationDeps = {},
) {
  const logger = deps.logger ?? console;
  const { oldAppointment, newAppointment } = params;
  const previousWhen = formatDayAndTime(oldAppointment.startTime);
  const newWhen = formatDayAndTime(newAppointment.startTime);

  try {
    await dispatchToBarber(
      newAppointment,
      'APPOINTMENT_RESCHEDULED',
      {
        title: 'Agendamento alterado',
        body: `O horário de ${newAppointment.customerName} mudou de ${previousWhen} para ${newWhen}.`,
        url: buildBarberAppointmentUrl(newAppointment),
        tag: `appointment-${newAppointment.id}`,
        type: 'APPOINTMENT_RESCHEDULED',
        appointmentId: newAppointment.id,
      },
      deps,
    );
  } catch (error) {
    logger.error('[push] falha ao notificar reagendamento', error);
  }
}
