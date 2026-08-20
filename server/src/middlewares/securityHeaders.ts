import type { NextFunction, Request, Response } from 'express';

/**
 * Cabecalhos de seguranca para uma API JSON. Nao ha HTML servido aqui, entao
 * a CSP se limita a impedir que as respostas sejam enquadradas ou tratadas
 * como outro tipo de conteudo.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  // HSTS apenas quando a requisicao ja chegou por HTTPS (atras do proxy do
  // Cloud Run), para nao quebrar o desenvolvimento local em http://localhost.
  const forwardedProto = req.header('x-forwarded-proto');
  if (req.secure || forwardedProto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
