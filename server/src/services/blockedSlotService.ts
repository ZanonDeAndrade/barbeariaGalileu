import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { ensureSlotsAvailable, normalizeToBusinessSlot } from './appointmentService.js';

const createBlockedSlotSchema = z.object({
  startTime: z.string().transform((value) => {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: 'Data/hora inválida',
          path: ['startTime'],
        },
      ]);
    }
    return parsed;
  }),
  reason: z.string().max(140, 'Máximo de 140 caracteres').optional(),
});

export type CreateBlockedSlotInput = z.infer<typeof createBlockedSlotSchema>;

type PrismaLike = typeof prisma;

export async function listBlockedSlots(dateISO?: string) {
  const filters = dateISO
    ? {
        startTime: {
          gte: startOfDay(parseISO(dateISO)),
          lte: endOfDay(parseISO(dateISO)),
        },
      }
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
    throw new HttpError(400, 'Horário fora do expediente');
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
  } catch (error) {
    throw new HttpError(404, 'Bloqueio não encontrado');
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
  // Mantém a mesma interpretação local usada no fluxo atual (sem fuso explícito)
  return parseISO(`${date}T${time}`);
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
    const parsed = parseDateTime(payload.date, time);
    if (Number.isNaN(parsed.getTime())) {
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
    const parsed = parseDateTime(payload.date, time);
    if (Number.isNaN(parsed.getTime())) {
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
