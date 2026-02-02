import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

const slowRequestMs = Number(process.env.SLOW_REQUEST_MS ?? 2000);

export function requestTimer(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  const start = performance.now();

  res.setHeader('x-request-id', reqId);
  (req as any).requestId = reqId;

  res.on('finish', () => {
    const duration = performance.now() - start;
    const message = `[${reqId}] ${req.method} ${req.originalUrl} -> status ${res.statusCode} ${duration.toFixed(1)}ms`;
    if (duration > slowRequestMs) {
      console.warn(message);
    } else {
      console.log(message);
    }
  });

  next();
}
