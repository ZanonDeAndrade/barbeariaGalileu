import axios from 'axios';
import { clearBarberApiKey, getBarberApiKey } from './barberAuth';

const isDev = import.meta.env.DEV;
const baseHost = isDev ? 'http://localhost:3000' : import.meta.env.VITE_API_URL;

const baseURL = (() => {
  if (!baseHost) {
    console.warn('[API] baseURL não definida. Verifique VITE_API_URL em produção.');
    return '';
  }
  const trimmed = baseHost.replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

export const apiBaseURL = baseURL;

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const reqId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Math.random().toString(16).slice(2)}`;
  (config as any).metadata = { start: performance.now(), reqId };

  // A chave do barbeiro acompanha toda requisicao do painel. Quem decide o que
  // ela libera e o servidor; aqui so a transportamos.
  const existingHeaders = (config.headers ?? {}) as Record<string, unknown>;
  const explicitKey = existingHeaders['x-barber-api-key'];
  const barberApiKey = explicitKey ?? getBarberApiKey() ?? undefined;

  config.headers = {
    ...existingHeaders,
    'x-request-id': reqId,
    ...(barberApiKey ? { 'x-barber-api-key': barberApiKey } : {}),
  } as any;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const meta = (response.config as any).metadata || { start: performance.now(), reqId: 'unknown' };
    const ttfb = performance.now() - meta.start;
    const total = ttfb;
    console.log(
      `[api ${meta.reqId}] ${response.config.url} status=${response.status} ttfb=${ttfb.toFixed(
        1,
      )}ms parse=~0ms total=${total.toFixed(1)}ms`,
    );
    return response;
  },
  (error) => {
    const meta = (error.config as any)?.metadata || { start: performance.now(), reqId: 'unknown' };
    const ttfb = performance.now() - meta.start;
    console.warn(
      `[api ${meta.reqId}] ${error.config?.url ?? 'unknown'} status=error ttfb=${ttfb.toFixed(1)}ms`,
    );

    // O servidor rejeitou a identidade: descarta a chave guardada e volta para
    // a tela de acesso. BARBER_KEY_MISSING e falha de configuracao do servidor,
    // nao chave errada, entao a chave local e preservada.
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 401 || (status === 403 && code === 'BARBER_KEY_INVALID')) {
      clearBarberApiKey();
    }

    return Promise.reject(error);
  },
);

export { api };
