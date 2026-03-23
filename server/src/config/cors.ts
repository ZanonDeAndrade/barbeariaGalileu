import cors, { CorsOptions } from 'cors';

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

console.log('[CORS] allowedOrigins:', allowedOrigins);

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function isAllowedOrigin(origin: string) {
  const normalizedOrigin = normalizeOrigin(origin);

  return allowedOrigins.some((allowedOrigin) => {
    if (!allowedOrigin.includes('*')) {
      return allowedOrigin === normalizedOrigin;
    }

    const pattern = `^${escapeRegex(allowedOrigin).replace(/\\\*/g, '.*')}$`;
    return new RegExp(pattern).test(normalizedOrigin);
  });
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Requests sem origin (Postman, curl, healthcheck...) → libera
    if (!origin) {
      console.log('[CORS] Request sem origin, liberando');
      return callback(null, true);
    }

    console.log('[CORS] Origin recebida:', origin);

    if (isAllowedOrigin(origin)) {
      console.log('[CORS] Origin permitida:', origin);
      return callback(null, true);
    }

    console.warn('[CORS] Origin NÃO permitida:', origin);
    // Não joga erro 500, só não libera CORS
    return callback(null, false);
  },
  credentials: true,
};

export const corsMiddleware = cors(corsOptions);
