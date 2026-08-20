import { api } from './api';

// A chave do barbeiro e anexada globalmente pelo interceptor em ./api.
export const blockedSlotsApi = {
  async blockBulk(date: string, times: string[], reason?: string) {
    const response = await api.post('/barber/blocked-slots/bulk', { date, times, reason });
    return response.data;
  },
  async unblockBulk(date: string, times: string[]) {
    const response = await api.delete('/barber/blocked-slots/bulk', {
      data: { date, times },
    });
    return response.data;
  },
};
