import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import router from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';

dotenv.config();

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : '*',
    }),
  );
  app.use(express.json());

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
