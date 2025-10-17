import type { CreateAppointmentPayload, HaircutOption, SlotAvailability } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

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
  createAppointment: (payload: CreateAppointmentPayload) =>
    request('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
