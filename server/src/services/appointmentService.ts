import { addMinutes, endOfDay, isBefore, parseISO, set, startOfDay } from 'date-fns';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';
import { getHaircutById, listHaircutOptions } from './haircutService.js';
import { notifyAppointmentConfirmation } from './notificationService.js';
import { normalizePhone } from '../utils/phone.js';

export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 19;
export const BUSINESS_END_MINUTE = 30; 
export const SLOT_INTERVAL_MINUTES = 30;

const createAppointmentSchema = z.object({
  customerName: z.string().min(3, 'Informe o nome completo'),
  customerPhone: z.string().min(8, 'Telefone inválido'),
  haircutType: z.string(),
  startTime: z.union([z.string(), z.date()]).transform((value) => {
    const parsed = value instanceof Date ? value : parseISO(value);
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

export async function cancelAppointment(appointmentId: string, params: { reason?: string }) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw new HttpError(404, 'Agendamento nÇœo encontrado');
  }

  if (appointment.status === 'CANCELLED') {
    throw new HttpError(409, 'Agendamento jÇ­ estÇ­ cancelado');
  }

  const reason = params.reason?.trim();

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledByRole: 'BARBER',
      cancelReason: reason ? reason : null,
    },
  });
}

export async function listHaircuts() {
  return listHaircutOptions();
}

export async function createAppointment(payload: CreateAppointmentInput) {
  const data = createAppointmentSchema.parse(payload);
  const customerPhone = normalizePhone(data.customerPhone);
  const notes = data.notes?.trim() ? data.notes.trim() : undefined;

  if (customerPhone.length < 8) {
    throw new HttpError(400, 'Telefone inválido');
  }

  const haircut = getHaircutById(data.haircutType);
  if (!haircut) {
    throw new HttpError(400, 'Tipo de corte inválido');
  }

  const slot = normalizeToBusinessSlot(data.startTime);
  if (!slot) {
    throw new HttpError(400, 'Horário fora do expediente');
  }

  const expectedSlotCount = Math.max(1, Math.ceil(haircut.durationMinutes / SLOT_INTERVAL_MINUTES));
  const requiredSlots = computeSequentialSlots(slot, haircut.durationMinutes);

  if (requiredSlots.length !== expectedSlotCount) {
    throw new HttpError(400, 'Horário fora do expediente');
  }

  await ensureSlotsAvailable(requiredSlots);

  let appointment;
  try {
    const customer = await prisma.customer.upsert({
      where: { phone: customerPhone },
      update: {},
      create: { phone: customerPhone },
    });

    appointment = await prisma.appointment.create({
      data: {
        customerName: data.customerName,
        customerPhone,
        customerId: customer.id,
        haircutType: haircut.id,
        notes,
        startTime: requiredSlots[0],
        durationMinutes: haircut.durationMinutes,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'HorÇ­rio indisponÇðvel');
    }
    throw error;
  }

  // Envia confirmação pelo WhatsApp sem bloquear a resposta da API.
  void notifyAppointmentConfirmation(appointment, haircut);

  return appointment;
}

export type CustomerAppointmentSummary = {
  id: string;
  startTime: string;
  haircutType: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED';
};

export async function listCustomerAppointments(
  customerId: string,
  options?: { limit?: number },
): Promise<CustomerAppointmentSummary[]> {
  const appointments = await prisma.appointment.findMany({
    where: { customerId },
    select: { id: true, startTime: true, haircutType: true, status: true },
    orderBy: { startTime: 'desc' },
    take: options?.limit,
  });

  return appointments.map((appointment) => ({
    id: appointment.id,
    startTime: appointment.startTime.toISOString(),
    haircutType: appointment.haircutType,
    status: appointment.status as CustomerAppointmentSummary['status'],
  }));
}

export async function listAppointmentsByPhone(
  phone: string,
  options?: { limit?: number },
): Promise<CustomerAppointmentSummary[]> {
  const normalized = normalizePhone(phone);
  const customer = await prisma.customer.findUnique({
    where: { phone: normalized },
    select: { id: true },
  });

  if (!customer) {
    return [];
  }

  return listCustomerAppointments(customer.id, options);
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
        status: {
          not: 'CANCELLED',
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
  const bookedSlotTimes = new Set<number>();
  const blockedSlotTimes = new Set<number>(
    blockedSlots.map((item) => item.startTime.getTime()),
  );

  appointments.forEach((appointment) => {
    const appointmentSlots = computeSequentialSlots(
      appointment.startTime,
      appointment.durationMinutes,
    );
    appointmentSlots.forEach((appointmentSlot) => {
      bookedSlotTimes.add(appointmentSlot.getTime());
    });
  });

  return slots.map((slot) => {
    const slotTime = slot.getTime();

    let status: SlotStatus = 'available';
    if (blockedSlotTimes.has(slotTime)) {
      status = 'blocked';
    } else if (bookedSlotTimes.has(slotTime)) {
      status = 'booked';
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
  const closingTime = set(businessDay, { hours: BUSINESS_END_HOUR, minutes: BUSINESS_END_MINUTE });

  if (isBefore(date, openingTime) || !isBefore(date, addMinutes(closingTime, SLOT_INTERVAL_MINUTES))) {
    return null;
  }

  const slots = generateDailySlots(businessDay);

  return (
    slots.find((slot) => slot.getTime() === date.getTime()) ?? null
  );
}

export function generateDailySlots(baseDate: Date): Date[] {
  const start = set(baseDate, { hours: BUSINESS_START_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
  const end = set(baseDate, { hours: BUSINESS_END_HOUR, minutes: BUSINESS_END_MINUTE, seconds: 0, milliseconds: 0 });

  const slots: Date[] = [];
  let current = start;

  while (isBefore(current, end) || current.getTime() === end.getTime()) {
    slots.push(current);
    current = addMinutes(current, SLOT_INTERVAL_MINUTES);
  }

  return slots;
}

function computeSequentialSlots(startSlot: Date, durationMinutes: number): Date[] {
  const slotsNeeded = Math.max(1, Math.ceil(durationMinutes / SLOT_INTERVAL_MINUTES));
  const businessSlots = generateDailySlots(startOfDay(startSlot));
  const slotMap = new Map<number, Date>(
    businessSlots.map((candidate) => [candidate.getTime(), candidate]),
  );

  const result: Date[] = [];
  for (let index = 0; index < slotsNeeded; index += 1) {
    const targetTime = addMinutes(startSlot, SLOT_INTERVAL_MINUTES * index).getTime();
    const match = slotMap.get(targetTime);
    if (!match) {
      break;
    }
    result.push(match);
  }

  return result;
}

export async function ensureSlotsAvailable(slots: Date[]) {
  if (slots.length === 0) {
    throw new HttpError(400, 'Horário inválido');
  }

  const requestedTimes = new Set(slots.map((slot) => slot.getTime()));
  const dayStart = startOfDay(slots[0]);
  const dayEnd = endOfDay(slots[0]);

  const [appointments, blocked] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          not: 'CANCELLED',
        },
      },
    }),
    prisma.blockedSlot.findMany({
      where: {
        startTime: {
          in: slots,
        },
      },
    }),
  ]);

  const conflictingAppointment = appointments.find((appointment) => {
    const appointmentSlots = computeSequentialSlots(
      appointment.startTime,
      appointment.durationMinutes,
    );
    return appointmentSlots.some(
      (appointmentSlot) => requestedTimes.has(appointmentSlot.getTime()),
    );
  });

  if (conflictingAppointment) {
    throw new HttpError(409, 'Horário indisponível');
  }

  if (blocked.length > 0) {
    throw new HttpError(409, 'Horário bloqueado pelo barbeiro');
  }
}
