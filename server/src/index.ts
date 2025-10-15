import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { disconnectPrisma } from './config/prisma.js';
import router from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;

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

const server = app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});

function gracefulShutdown() {
  console.log('Encerrando servidor...');
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
