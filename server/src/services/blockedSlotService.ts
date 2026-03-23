import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { getBrazilDayUtcRange, parseBrazilDateTimeToUtcDate } from '../utils/dateTime.js';
import { ensureSlotsAvailable, normalizeToBusinessSlot } from './appointmentService.js';

export type CreateBlockedSlotInput = {
  startTime: string | Date;
  reason?: string;
};

const createBlockedSlotSchema = z.object({
  startTime: z.string().transform<Date>((value) => {
    try {
      return parseBrazilDateTimeToUtcDate(value, 'startTime');
    } catch {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: 'Data/hora invalida',
          path: ['startTime'],
        },
      ]);
    }
  }),
  reason: z.string().max(140, 'Maximo de 140 caracteres').optional(),
});

type PrismaLike = typeof prisma;

export async function listBlockedSlots(dateISO?: string) {
  const filters = dateISO
    ? (() => {
        let startUtc: Date;
        let endUtc: Date;
        try {
          ({ startUtc, endUtc } = getBrazilDayUtcRange(dateISO));
        } catch {
          throw new HttpError(400, 'Formato de data invalido');
        }

        return {
          startTime: {
            gte: startUtc,
            lte: endUtc,
          },
        };
      })()
    : undefined;

  return prisma.blockedSlot.findMany({
    where: filters,
    orderBy: {
      startTime: 'asc',
    },
  });
}

export async function createBlockedSlot(payload: CreateBlockedSlotInput) {
  const data = createBlockedSlotSchema.parse(payload);

  const slot = normalizeToBusinessSlot(data.startTime);
  if (!slot) {
    throw new HttpError(400, 'Horario fora do expediente');
  }

  await ensureSlotsAvailable([slot]);

  return prisma.blockedSlot.create({
    data: {
      startTime: slot,
      reason: data.reason,
    },
  });
}

export async function removeBlockedSlot(id: string) {
  try {
    await prisma.blockedSlot.delete({
      where: { id },
    });
  } catch {
    throw new HttpError(404, 'Bloqueio nao encontrado');
  }
}

type BulkBlockInput = {
  date: string;
  times: string[];
  reason?: string;
};

type BulkResult = {
  created: string[];
  skipped: Array<{ time: string; reason: 'invalid_slot' | 'appointment_conflict' | 'already_blocked' }>;
};

function parseDateTime(date: string, time: string) {
  return parseBrazilDateTimeToUtcDate(`${date}T${time}`, 'startTime');
}

export async function createBlockedSlotsBulk(
  payload: BulkBlockInput,
  deps: { prismaClient?: PrismaLike } = {},
): Promise<BulkResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const uniqueTimes = Array.from(new Set(payload.times));

  const candidateSlots: Array<{ time: string; startTime: Date }> = [];
  const skipped: BulkResult['skipped'] = [];

  for (const time of uniqueTimes) {
    let parsed: Date;
    try {
      parsed = parseDateTime(payload.date, time);
    } catch {
      skipped.push({ time, reason: 'invalid_slot' });
      continue;
    }

    const normalized = normalizeToBusinessSlot(parsed);
    if (!normalized) {
      skipped.push({ time, reason: 'invalid_slot' });
      continue;
    }

    candidateSlots.push({ time, startTime: normalized });
  }

  if (candidateSlots.length === 0) {
    return { created: [], skipped };
  }

  const startTimes = candidateSlots.map((slot) => slot.startTime);

  const [conflictingAppointments, existingBlocks] = await Promise.all([
    prismaClient.appointment.findMany({
      where: {
        startTime: { in: startTimes },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    }),
    prismaClient.blockedSlot.findMany({
      where: { startTime: { in: startTimes } },
    }),
  ]);

  const conflictTimes = new Set(conflictingAppointments.map((item) => item.startTime.getTime()));
  const alreadyBlockedTimes = new Set(existingBlocks.map((item) => item.startTime.getTime()));

  const creatable = candidateSlots.filter((slot) => {
    const timeValue = slot.startTime.getTime();
    if (conflictTimes.has(timeValue)) {
      skipped.push({ time: slot.time, reason: 'appointment_conflict' });
      return false;
    }
    if (alreadyBlockedTimes.has(timeValue)) {
      skipped.push({ time: slot.time, reason: 'already_blocked' });
      return false;
    }
    return true;
  });

  if (creatable.length > 0) {
    await prismaClient.blockedSlot.createMany({
      data: creatable.map((slot) => ({
        startTime: slot.startTime,
        reason: payload.reason,
      })),
      skipDuplicates: true,
    });
  }

  return {
    created: creatable.map((item) => item.time),
    skipped,
  };
}

type BulkDeleteInput = {
  date: string;
  times: string[];
};

type BulkDeleteResult = {
  removed: string[];
  notFound: string[];
};

export async function deleteBlockedSlotsBulk(
  payload: BulkDeleteInput,
  deps: { prismaClient?: PrismaLike } = {},
): Promise<BulkDeleteResult> {
  const prismaClient = deps.prismaClient ?? prisma;
  const uniqueTimes = Array.from(new Set(payload.times));

  const validSlots: Array<{ time: string; startTime: Date }> = [];
  const invalidTimes: string[] = [];

  for (const time of uniqueTimes) {
    let parsed: Date;
    try {
      parsed = parseDateTime(payload.date, time);
    } catch {
      invalidTimes.push(time);
      continue;
    }

    const normalized = normalizeToBusinessSlot(parsed);
    if (!normalized) {
      invalidTimes.push(time);
      continue;
    }

    validSlots.push({ time, startTime: normalized });
  }

  if (validSlots.length === 0) {
    return { removed: [], notFound: uniqueTimes };
  }

  const startTimes = validSlots.map((slot) => slot.startTime);
  const existing = await prismaClient.blockedSlot.findMany({
    where: { startTime: { in: startTimes } },
  });
  const existingTimes = new Set(existing.map((item) => item.startTime.getTime()));

  const foundSlots = validSlots.filter((slot) => existingTimes.has(slot.startTime.getTime()));
  const removedTimes = foundSlots.map((slot) => slot.time);

  if (foundSlots.length > 0) {
    await prismaClient.blockedSlot.deleteMany({
      where: { startTime: { in: foundSlots.map((slot) => slot.startTime) } },
    });
  }

  const notFoundTimes = validSlots
    .filter((slot) => !existingTimes.has(slot.startTime.getTime()))
    .map((slot) => slot.time)
    .concat(invalidTimes);

  return {
    removed: removedTimes,
    notFound: notFoundTimes,
  };
}
