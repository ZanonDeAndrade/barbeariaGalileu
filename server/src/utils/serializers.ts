import type { Appointment, BlockedSlot } from '@prisma/client';
import { toBrazilIsoString } from './dateTime.js';

export type SerializedAppointment = Omit<
  Appointment,
  'startTime' | 'cancelledAt' | 'createdAt' | 'updatedAt'
> & {
  startTime: string;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedBlockedSlot = Omit<BlockedSlot, 'startTime' | 'createdAt'> & {
  startTime: string;
  createdAt: string;
};

export function serializeAppointment(appointment: Appointment): SerializedAppointment {
  return {
    ...appointment,
    startTime: toBrazilIsoString(appointment.startTime),
    cancelledAt: appointment.cancelledAt ? toBrazilIsoString(appointment.cancelledAt) : null,
    createdAt: toBrazilIsoString(appointment.createdAt),
    updatedAt: toBrazilIsoString(appointment.updatedAt),
  };
}

export function serializeAppointments(appointments: Appointment[]) {
  return appointments.map(serializeAppointment);
}

export function serializeBlockedSlot(blockedSlot: BlockedSlot): SerializedBlockedSlot {
  return {
    ...blockedSlot,
    startTime: toBrazilIsoString(blockedSlot.startTime),
    createdAt: toBrazilIsoString(blockedSlot.createdAt),
  };
}

export function serializeBlockedSlots(blockedSlots: BlockedSlot[]) {
  return blockedSlots.map(serializeBlockedSlot);
}

export function serializeRescheduleResult(result: {
  newAppointment: Appointment;
  oldAppointment: Appointment;
}) {
  return {
    newAppointment: serializeAppointment(result.newAppointment),
    oldAppointment: serializeAppointment(result.oldAppointment),
  };
}
