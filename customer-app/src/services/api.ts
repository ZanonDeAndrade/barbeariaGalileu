import axios from 'axios';

const isDev = import.meta.env.DEV;
const baseHost = isDev ? 'http://localhost:4000' : import.meta.env.VITE_API_URL;

const baseURL = (() => {
  if (!baseHost) {
    console.warn('[API] baseURL não definida. Verifique VITE_API_URL em produção.');
    return '';
  }
  const trimmed = baseHost.replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const reqId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Math.random().toString(16).slice(2)}`;
  (config as any).metadata = { start: performance.now(), reqId };
  config.headers = {
    ...(config.headers as any),
    'x-request-id': reqId,
  } as any;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const meta = (response.config as any).metadata || { start: performance.now(), reqId: 'unknown' };
    const ttfb = performance.now() - meta.start;
    const total = ttfb; // axios já devolve parseado
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
    return Promise.reject(error);
  },
);

export { api };
