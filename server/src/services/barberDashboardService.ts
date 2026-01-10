import type { PrismaClient, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export type AppointmentsSummary = {
  month: string;
  total: number;
  byService: { haircutType: string; count: number }[];
};

type PrismaLike = Pick<PrismaClient, '$transaction' | 'appointment'>;

function getMonthUtcRange(month: string, timeZone: string) {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  const startZoned = DateTime.fromObject(
    { year, month: monthNumber, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: timeZone },
  );

  if (!startZoned.isValid) {
    throw new HttpError(400, 'Mês inválido');
  }

  const endZoned = startZoned.plus({ months: 1 });

  return {
    startUtc: startZoned.toUTC().toJSDate(),
    endUtc: endZoned.toUTC().toJSDate(),
  };
}

export async function getMonthlyAppointmentsSummary(
  params: {
    month: string;
    includeCanceled: boolean;
    timeZone?: string;
  },
  deps: {
    prismaClient?: PrismaLike;
  } = {},
): Promise<AppointmentsSummary> {
  const prismaClient = deps.prismaClient ?? prisma;
  const timeZone = params.timeZone ?? DEFAULT_TIME_ZONE;
  const { startUtc, endUtc } = getMonthUtcRange(params.month, timeZone);

  const where: Prisma.AppointmentWhereInput = {
    startTime: {
      gte: startUtc,
      lt: endUtc,
    },
  };

  if (!params.includeCanceled) {
    where.status = {
      not: 'CANCELLED',
    };
  }

  // Prisma `groupBy` types can trigger TS recursion errors; keep runtime strict and cast locally.
  const appointmentClient = prismaClient.appointment as any;

  const totalOp = appointmentClient.aggregate({
    where,
    _count: { id: true },
  }) as Promise<{ _count: { id: number } }>;

  const byServiceOp = appointmentClient.groupBy({
    by: ['haircutType'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  }) as Promise<Array<{ haircutType: string; _count: { id: number } }>>;

  const [aggregateTotal, byService] = await prismaClient.$transaction([totalOp as any, byServiceOp as any]);

  return {
    month: params.month,
    total: aggregateTotal?._count?.id ?? 0,
    byService: byService.map((item) => ({
      haircutType: item.haircutType,
      count: item._count.id,
    })),
  };
}
