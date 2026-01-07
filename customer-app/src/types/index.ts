export type SlotStatus = 'available' | 'booked' | 'blocked';

export interface HaircutOption {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
}

export interface SlotAvailability {
  startTime: string;
  status: SlotStatus;
}

export interface CreateAppointmentPayload {
  customerName: string;
  customerPhone: string;
  haircutType: string;
  startTime: string;
  notes?: string;
}

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED';

export interface CustomerAppointmentSummary {
  id: string;
  startTime: string;
  haircutType: string;
  status: AppointmentStatus;
}
