import { api } from './api';
import type { CreateAppointmentPayload } from '../types';

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await api.post<T>(url, body);
  return response.data;
}

export const paymentsApi = {
  processCard: (params: {
    amount: number;
    description: string;
    appointment: CreateAppointmentPayload;
    cardPayload: Record<string, unknown>;
  }) =>
    post<{ status: string; mpPaymentId?: string; appointmentId?: string }>(
      '/process-payment',
      params,
    ),

  createPix: (params: {
    amount: number;
    description: string;
    payer: { email: string; first_name?: string };
    appointment: CreateAppointmentPayload;
  }) =>
    post<{
      status: string;
      mpPaymentId?: string;
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    }>('/payment/pix', params),

  cash: (appointment: CreateAppointmentPayload) =>
    post<{ appointmentId: string; status: 'pending' }>('/payment/cash', appointment),
};
