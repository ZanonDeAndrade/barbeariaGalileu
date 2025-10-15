import { addMinutes, endOfDay, isBefore, parseISO, set, startOfDay } from 'date-fns';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { getHaircutById, listHaircutOptions } from './haircutService.js';

export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 18;
export const SLOT_INTERVAL_MINUTES = 60;

const createAppointmentSchema = z.object({
  customerName: z.string().min(3, 'Informe o nome completo'),
  customerPhone: z.string().min(8, 'Telefone inválido'),
  haircutType: z.string(),
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
  notes: z.string().max(280).optional(),
});

type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

type SlotStatus = 'available' | 'booked' | 'blocked';

export interface SlotAvailability {
  startTime: string;
  status: SlotStatus;
}

export async function listAppointments() {
  const today = startOfDay(new Date());

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: {
        gte: today,
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  return appointments;
}

export async function listHaircuts() {
  return listHaircutOptions();
}

export async function createAppointment(payload: CreateAppointmentInput) {
  const data = createAppointmentSchema.parse(payload);

  const haircut = getHaircutById(data.haircutType);
  if (!haircut) {
    throw new HttpError(400, 'Tipo de corte inválido');
  }

  const slot = normalizeToBusinessSlot(data.startTime);
  if (!slot) {
    throw new HttpError(400, 'Horário fora do expediente');
  }

  await ensureSlotAvailable(slot);

  const appointment = await prisma.appointment.create({
    data: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      haircutType: haircut.id,
      notes: data.notes,
      startTime: slot,
      durationMinutes: haircut.durationMinutes,
    },
  });

  return appointment;
}

export async function getAvailability(dateISO: string | undefined): Promise<SlotAvailability[]> {
  if (!dateISO) {
    throw new HttpError(400, 'Informe uma data válida (YYYY-MM-DD)');
  }

  let date: Date;
  try {
    date = parseISO(dateISO);
  } catch (error) {
    throw new HttpError(400, 'Formato de data inválido');
  }

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Formato de data inválido');
  }

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [appointments, blockedSlots] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    }),
    prisma.blockedSlot.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    }),
  ]);

  const slots = generateDailySlots(dayStart);

  return slots.map((slot) => {
    const appointment = appointments.find(
      (item) => item.startTime.getTime() === slot.getTime(),
    );
    const blocked = blockedSlots.find(
      (item) => item.startTime.getTime() === slot.getTime(),
    );

    let status: SlotStatus = 'available';
    if (appointment) {
      status = 'booked';
    }
    if (blocked) {
      status = 'blocked';
    }

    return {
      startTime: slot.toISOString(),
      status,
    };
  });
}

export function normalizeToBusinessSlot(date: Date): Date | null {
  const businessDay = startOfDay(date);
  const openingTime = set(businessDay, { hours: BUSINESS_START_HOUR });
  const closingTime = set(businessDay, { hours: BUSINESS_END_HOUR });

  if (isBefore(date, openingTime) || !isBefore(date, closingTime)) {
    return null;
  }

  const slots = generateDailySlots(businessDay);

  return (
    slots.find((slot) => slot.getTime() === date.getTime()) ?? null
  );
}

export function generateDailySlots(baseDate: Date): Date[] {
  const start = set(baseDate, { hours: BUSINESS_START_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
  const end = set(baseDate, { hours: BUSINESS_END_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });

  const slots: Date[] = [];
  let current = start;

  while (isBefore(current, end)) {
    slots.push(current);
    current = addMinutes(current, SLOT_INTERVAL_MINUTES);
  }

  return slots;
}

export async function ensureSlotAvailable(slot: Date) {
  const [appointment, blocked] = await Promise.all([
    prisma.appointment.findUnique({
      where: { startTime: slot },
    }),
    prisma.blockedSlot.findUnique({
      where: { startTime: slot },
    }),
  ]);

  if (appointment) {
    throw new HttpError(409, 'Horário indisponível');
  }

  if (blocked) {
    throw new HttpError(409, 'Horário bloqueado pelo barbeiro');
  }
}
