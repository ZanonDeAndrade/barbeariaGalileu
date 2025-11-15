import type { CreateAppointmentPayload } from '../types';

const resolveDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:4000/api';
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000/api`;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? resolveDefaultApiBaseUrl();

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(init || {}),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const paymentsApi = {
  processCard: (params: {
    amount: number;
    description: string;
    appointment: CreateAppointmentPayload;
    cardPayload: Record<string, unknown>;
  }) => req<{ status: string; mpPaymentId?: string; appointmentId?: string }>(
    '/process-payment',
    { body: JSON.stringify(params) },
  ),

  createPix: (params: {
    amount: number;
    description: string;
    payer: { email: string; first_name?: string };
    appointment: CreateAppointmentPayload;
  }) =>
    req<{
      status: string;
      mpPaymentId?: string;
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    }>('/payment/pix', { body: JSON.stringify(params) }),

  cash: (appointment: CreateAppointmentPayload) =>
    req<{ appointmentId: string; status: 'pending' }>(
      '/payment/cash',
      { body: JSON.stringify(appointment) },
    ),
};

