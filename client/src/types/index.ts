export type SlotStatus = 'available' | 'booked' | 'blocked';

export interface HaircutOption {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
}

export interface SlotAvailability {
  startTime: string;
  status: SlotStatus;
}

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  haircutType: string;
  notes?: string | null;
  startTime: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedSlot {
  id: string;
  startTime: string;
  reason?: string | null;
  createdAt: string;
}

export interface CreateAppointmentPayload {
  customerName: string;
  customerPhone: string;
  haircutType: string;
  startTime: string;
  notes?: string;
}

export interface CreateBlockedSlotPayload {
  startTime: string;
  reason?: string;
}
