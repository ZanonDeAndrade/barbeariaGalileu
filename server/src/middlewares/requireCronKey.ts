import type { NextFunction, Request, Response } from 'express';

/**
 * Protege a rota de disparo manual/cron de lembretes.
 * Aceita PUSH_CRON_KEY (header x-cron-key) quando definida; caso contrario,
 * aceita a BARBER_API_KEY (header x-barber-api-key). Se nenhuma chave estiver
 * configurada, a rota fica bloqueada por seguranca (evita disparo aberto).
 */
export function requireCronKey(req: Request, res: Response, next: NextFunction) {
  const cronKey = process.env.PUSH_CRON_KEY;
  const barberKey = process.env.BARBER_API_KEY;

  if (cronKey) {
    const provided = req.header('x-cron-key');
    if (provided && provided === cronKey) {
      return next();
    }
  }

  if (barberKey) {
    const provided = req.header('x-barber-api-key');
    if (provided && provided === barberKey) {
      return next();
    }
  }

  return res.status(403).json({ message: 'Acesso negado' });
}
