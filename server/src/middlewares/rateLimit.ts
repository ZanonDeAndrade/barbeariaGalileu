import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = typeof raw === 'string' && raw.length > 0 ? raw.split(',')[0].trim() : req.ip;
  return ip || 'unknown';
}

export function rateLimit(options: RateLimitOptions) {
  const store = new Map<string, Counter>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
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

