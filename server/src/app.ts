import dotenv from 'dotenv';
import express from 'express';
import router from './routes/index.js';
import webhooksRouter from './routes/webhooks.routes.js';
import { errorHandler } from './utils/errorHandler.js';
import { corsMiddleware } from './config/cors.js';
import { requestTimer } from './middlewares/requestTimer.js';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(requestTimer);
  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/webhooks', webhooksRouter);
  app.use('/api', router);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
