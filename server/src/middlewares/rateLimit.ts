import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

/**
 * Limite por IP em memoria.
 *
 * O default passou a ser 'memory' tambem em producao. Antes o default em
 * producao era 'none', o que transformava TODO rate limit da aplicacao em
 * no-op — inclusive o de POST /api/appointments/by-phone (enumeracao de
 * agenda por telefone) e o da chave do barbeiro (brute force). Em varias
 * instancias o contador e por instancia, o que enfraquece o limite, mas e
 * estritamente melhor do que nao ter limite algum.
 *
 * RATE_LIMIT_STORE=none continua disponivel como desligamento explicito.
 */
const rateLimitStoreMode = process.env.RATE_LIMIT_STORE ?? 'memory';

/**
 * Usa req.ip, que o Express calcula a partir de X-Forwarded-For respeitando o
 * `trust proxy` configurado no app (1 hop, o proxy do Cloud Run).
 *
 * A versao anterior lia o PRIMEIRO valor do X-Forwarded-For direto do header.
 * Esse valor e escrito pelo cliente: bastava mandar um IP diferente em cada
 * requisicao para zerar o contador e anular todo o rate limit (brute force da
 * chave do barbeiro, enumeracao por telefone).
 */
function getClientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(options: RateLimitOptions) {
  if (rateLimitStoreMode !== 'memory') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const store = new Map<string, Counter>();
  let lastSweepAt = 0;

  // Sem isso o Map cresce indefinidamente (uma entrada por IP visto), o que e
  // um vetor de exaustao de memoria em processo de longa duracao.
  function sweepExpired(now: number) {
    if (now - lastSweepAt < options.windowMs) {
      return;
    }
    lastSweepAt = now;
    for (const [key, counter] of store) {
      if (now >= counter.resetAt) {
        store.delete(key);
      }
    }
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweepExpired(now);

    const key = getClientIp(req);
    const current = store.get(key);

    if (!current || now >= current.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({
        message: 'Muitas requisições. Tente novamente mais tarde.',
      });
    }

    return next();
  };
}
