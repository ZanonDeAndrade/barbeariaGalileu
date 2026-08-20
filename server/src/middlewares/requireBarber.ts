import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Autorizacao do painel do barbeiro.
 *
 * Esta e a UNICA fronteira de seguranca da area do barbeiro: o barber-app e um
 * site estatico publico, entao nada que ele faca (esconder botao, guardar flag,
 * etc.) protege dado algum. Toda rota que le ou altera dados do barbeiro precisa
 * passar por aqui.
 *
 * Politica fail-closed: sem BARBER_API_KEY configurada no servidor a rota fica
 * bloqueada. A versao anterior (requireBarberKey) chamava next() nesse caso, o
 * que deixava a API inteira aberta em qualquer deploy sem a variavel definida.
 *
 * Semantica de status:
 *   403 + BARBER_KEY_MISSING -> servidor sem chave configurada (fail-closed)
 *   401 + BARBER_KEY_REQUIRED -> identidade ausente (header nao enviado)
 *   403 + BARBER_KEY_INVALID -> identidade presente, porem sem permissao
 */

export const BARBER_KEY_HEADER = 'x-barber-api-key';

/**
 * Contencao de brute force sobre a chave.
 *
 * Fica DENTRO do requireBarber de proposito: um rate limit montado depois da
 * verificacao nunca chega a ver as tentativas recusadas, e um montado antes
 * penalizaria tambem o uso legitimo do painel. Aqui so tentativas invalidas
 * contam, entao o barbeiro autenticado nunca e limitado.
 */
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 20;

type FailureCounter = { count: number; resetAt: number };
const failuresByIp = new Map<string, FailureCounter>();
let lastSweepAt = 0;

function clientKey(req: Request) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function sweep(now: number) {
  if (now - lastSweepAt < FAILURE_WINDOW_MS) return;
  lastSweepAt = now;
  for (const [key, counter] of failuresByIp) {
    if (now >= counter.resetAt) failuresByIp.delete(key);
  }
}

function isThrottled(req: Request): boolean {
  const now = Date.now();
  sweep(now);
  const counter = failuresByIp.get(clientKey(req));
  return Boolean(counter && now < counter.resetAt && counter.count >= MAX_FAILURES_PER_WINDOW);
}

function registerFailure(req: Request) {
  const now = Date.now();
  const key = clientKey(req);
  const counter = failuresByIp.get(key);

  if (!counter || now >= counter.resetAt) {
    failuresByIp.set(key, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
    return;
  }

  counter.count += 1;
}

/** Usado apenas pelos testes, para isolar cenarios. */
export function resetBarberAuthThrottle() {
  failuresByIp.clear();
  lastSweepAt = 0;
}

/**
 * Le a chave configurada no servidor, ja normalizada.
 *
 * O trim aqui NAO e cosmetico: o painel envia `key.trim()` (BarberLogin e
 * barberAuth), entao um valor guardado com espaco ou quebra de linha no fim
 * nunca casaria — e o resultado seria um 403 permanente, impossivel de
 * diagnosticar pela mensagem. Esse e o modo de falha classico de secret criado
 * com `echo` (que acrescenta \n) em vez de `printf %s`.
 *
 * Consequencia deliberada: espaco no inicio/fim nao faz parte da chave.
 */
export function getConfiguredBarberKey(): string | null {
  const key = process.env.BARBER_API_KEY;

  if (typeof key !== 'string') {
    return null;
  }

  const normalized = key.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Comparacao em tempo constante. Uma comparacao com === vaza, pelo tempo de
 * resposta, quantos caracteres iniciais da chave o atacante acertou.
 */
export function safeCompare(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    // Compara contra si mesmo para manter o custo constante mesmo quando o
    // tamanho difere (o resultado e descartado).
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function requireBarber(req: Request, res: Response, next: NextFunction) {
  if (isThrottled(req)) {
    res.setHeader('Retry-After', Math.ceil(FAILURE_WINDOW_MS / 1000).toString());
    return res.status(429).json({
      message: 'Muitas tentativas. Tente novamente mais tarde.',
      code: 'TOO_MANY_ATTEMPTS',
    });
  }

  const expectedKey = getConfiguredBarberKey();

  if (!expectedKey) {
    return res.status(403).json({
      message: 'Area do barbeiro indisponivel neste servidor',
      code: 'BARBER_KEY_MISSING',
    });
  }

  const providedKey = req.header(BARBER_KEY_HEADER);

  if (!providedKey) {
    return res.status(401).json({
      message: 'Autenticacao obrigatoria',
      code: 'BARBER_KEY_REQUIRED',
    });
  }

  if (!safeCompare(providedKey, expectedKey)) {
    registerFailure(req);
    // Log de evento de seguranca sem ecoar a chave enviada.
    console.warn(`[authz] barber key invalida em ${req.method ?? '?'} ${req.path ?? '?'}`);
    return res.status(403).json({
      message: 'Acesso negado',
      code: 'BARBER_KEY_INVALID',
    });
  }

  (req as Request & { isBarber?: boolean }).isBarber = true;
  return next();
}
