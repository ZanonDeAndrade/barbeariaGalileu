import type {
  Appointment,
  BlockedSlot,
  CreateBlockedSlotPayload,
  HaircutOption,
  SlotAvailability,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = 'Erro inesperado na requisição';
    let details: unknown;

    try {
      const errorPayload = await response.json();
      message = errorPayload?.message ?? message;
      details = errorPayload?.details;
    } catch (error) {
      // ignore json parse errors
    }

    throw new ApiError(response.status, message, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getHaircuts: () => request<HaircutOption[]>('/haircuts'),
  getAvailability: (date: string) => request<SlotAvailability[]>(`/appointments/availability?date=${date}`),
  listAppointments: () => request<Appointment[]>('/appointments'),
  createBlockedSlot: (payload: CreateBlockedSlotPayload) =>
    request<BlockedSlot>('/blocked-slots', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listBlockedSlots: (date?: string) => {
    const query = date ? `?date=${date}` : '';
    return request<BlockedSlot[]>(`/blocked-slots${query}`);
  },
  removeBlockedSlot: (id: string) =>
    request<void>(`/blocked-slots/${id}`, {
      method: 'DELETE',
    }),
};
