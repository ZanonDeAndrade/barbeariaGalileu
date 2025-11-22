import cors, { CorsOptions } from 'cors';

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log('[CORS] allowedOrigins:', allowedOrigins);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Requests sem origin (Postman, curl, healthcheck...) → libera
    if (!origin) {
      console.log('[CORS] Request sem origin, liberando');
      return callback(null, true);
    }

    console.log('[CORS] Origin recebida:', origin);

    if (allowedOrigins.includes(origin)) {
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
