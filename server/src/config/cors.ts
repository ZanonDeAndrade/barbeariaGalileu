import cors, { CorsOptions } from 'cors';

export const CORS_ERROR_MESSAGE = 'Not allowed by CORS';

const defaultAllowedOrigins = [
  'https://barbearia-galileu-st53.vercel.app',
  'https://barbearia-galileu-3229.vercel.app',
];

const corsMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const corsAllowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Request-Id',
  'X-Barber-Api-Key',
];

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));

console.log('[CORS] allowedOrigins:', allowedOrigins);

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

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS] blocked origin:', origin);
    return callback(new Error(CORS_ERROR_MESSAGE));
  },
  methods: corsMethods,
  allowedHeaders: corsAllowedHeaders,
  credentials: true,
  optionsSuccessStatus: 204,
};

export const corsMiddleware = cors(corsOptions);
export const corsPreflightMiddleware = cors(corsOptions);
