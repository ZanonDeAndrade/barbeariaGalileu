import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './httpError.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code ?? (typeof err.details === 'object' && err.details && 'code' in (err.details as any)
        ? (err.details as any).code
        : undefined),
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Erro de validação',
      details: err.flatten(),
    });
  }

  console.error('Unhandled error:', err);

  return res.status(500).json({
    message: 'Erro interno no servidor',
  });
}
