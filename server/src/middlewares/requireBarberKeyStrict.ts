import type { NextFunction, Request, Response } from 'express';

/**
 * Variante fail-closed de requireBarberKey: exige que BARBER_API_KEY esteja
 * configurada E que o header confira. Usada na inscricao push do barbeiro,
 * pois uma inscricao aberta permitiria a qualquer um receber passivamente as
 * notificacoes do barbeiro (nomes/horarios de clientes).
 */
export function requireBarberKeyStrict(req: Request, res: Response, next: NextFunction) {
  const expectedKey = process.env.BARBER_API_KEY;

  if (!expectedKey) {
    return res.status(403).json({ message: 'Acesso negado' });
  }

  const providedKey = req.header('x-barber-api-key');
  if (providedKey && providedKey === expectedKey) {
    return next();
  }

  return res.status(403).json({ message: 'Acesso negado' });
}
