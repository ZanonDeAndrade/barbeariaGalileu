import type { NextFunction, Request, Response } from 'express';

export function requireBarberKey(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.BARBER_API_KEY;

  if (!expectedKey) {
    return next();
  }

  const providedKey = req.header('x-barber-api-key');
  if (providedKey && providedKey === expectedKey) {
    return next();
  }

  return res.status(403).json({ message: 'Acesso negado' });
}

