import dotenv from 'dotenv';
import express from 'express';
import router from './routes/index.js';
import webhooksRouter from './routes/webhooks.routes.js';
import { errorHandler } from './utils/errorHandler.js';
import { corsMiddleware, corsPreflightMiddleware } from './config/cors.js';
import { requestTimer } from './middlewares/requestTimer.js';
import { securityHeaders } from './middlewares/securityHeaders.js';

dotenv.config();

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.options('*', corsPreflightMiddleware);
  app.use(requestTimer);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // Limite explicito de corpo: o webhook do Mercado Pago grava o body cru na
  // tabela WebhookEvent, entao um payload grande vira crescimento de banco.
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));

  app.use('/webhooks', webhooksRouter);
  app.use('/api', router);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
