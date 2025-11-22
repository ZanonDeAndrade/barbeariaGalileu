import dotenv from 'dotenv';
import express from 'express';
import router from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { corsMiddleware } from './config/cors.js';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
  app.use(express.json());

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
