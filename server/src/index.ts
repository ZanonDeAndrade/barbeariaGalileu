import { disconnectPrisma } from './config/prisma.js';
import { app } from './app.js';

const port = Number(process.env.PORT) || 4000;

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
