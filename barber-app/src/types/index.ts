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

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED';
export type CancelledByRole = 'BARBER';

export type MonthlyAppointmentsSummary = {
  month: string;
  total: number;
  byService: { haircutType: string; count: number }[];
};

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  haircutType: string;
  notes?: string | null;
  startTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  cancelledAt?: string | null;
  cancelledByRole?: CancelledByRole | null;
  cancelReason?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedSlot {
  id: string;
  startTime: string;
  reason?: string | null;
  createdAt: string;
}

export interface CreateBlockedSlotPayload {
  startTime: string;
  reason?: string;
}
