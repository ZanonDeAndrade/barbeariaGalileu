import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { ensureSlotAvailable, normalizeToBusinessSlot } from './appointmentService.js';

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

  await ensureSlotAvailable(slot);

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
