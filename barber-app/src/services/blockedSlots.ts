import { api } from './api';

function authHeaders() {
  const apiKey = (import.meta as any).env.VITE_BARBER_API_KEY;
  return apiKey ? { 'x-barber-api-key': apiKey } : undefined;
}

export const blockedSlotsApi = {
  async blockBulk(date: string, times: string[], reason?: string) {
    const response = await api.post(
      '/barber/blocked-slots/bulk',
      { date, times, reason },
      { headers: authHeaders() },
    );
    return response.data;
  },
  async unblockBulk(date: string, times: string[]) {
    const response = await api.delete('/barber/blocked-slots/bulk', {
      data: { date, times },
      headers: authHeaders(),
    });
    return response.data;
  },
};
