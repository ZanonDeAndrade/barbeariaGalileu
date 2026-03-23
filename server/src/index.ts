import { disconnectPrisma } from './config/prisma.js';
import { app } from './app.js';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

function getPort() {
  const parsedPort = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
  return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
}

function getShutdownTimeoutMs() {
  const parsedTimeout = Number.parseInt(
    process.env.SHUTDOWN_TIMEOUT_MS ?? `${DEFAULT_SHUTDOWN_TIMEOUT_MS}`,
    10,
  );
  return Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_SHUTDOWN_TIMEOUT_MS;
}

const PORT = getPort();
const HOST = process.env.HOST || DEFAULT_HOST;
const shutdownTimeoutMs = getShutdownTimeoutMs();
let isShuttingDown = false;

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] listening on ${HOST}:${PORT}`);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

async function gracefulShutdown(reason: string, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[server] shutdown started (${reason})`);

  const forceShutdownTimer = setTimeout(() => {
    console.error(`[server] forced shutdown after ${shutdownTimeoutMs}ms`);
    server.closeAllConnections?.();
    process.exit(1);
  }, shutdownTimeoutMs);
  forceShutdownTimer.unref();

  server.close(async (serverError) => {
    clearTimeout(forceShutdownTimer);

    if (serverError) {
      console.error('[server] error while closing HTTP server', serverError);
      process.exit(1);
      return;
    }

    try {
      await disconnectPrisma();
      console.log('[server] shutdown completed');
      process.exit(exitCode);
    } catch (error) {
      console.error('[server] error while disconnecting Prisma', error);
      process.exit(1);
    }
  });

  server.closeIdleConnections?.();
}

server.on('error', (error) => {
  console.error('[server] failed to start', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception', error);
  void gracefulShutdown('uncaughtException', 1);
});
