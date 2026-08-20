import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Valida a assinatura x-signature do Mercado Pago.
 *
 * Manifesto assinado pelo MP: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (partes ausentes sao omitidas). O HMAC-SHA256 usa o "segredo do webhook" do
 * painel do Mercado Pago.
 *
 * Comportamento quando MP_WEBHOOK_SECRET nao esta configurada:
 *
 *   TEMPORARIO, por decisao explicita: a requisicao segue com um warning, em
 *   vez de ser recusada. Isso mantem exatamente o comportamento que ja existia
 *   em producao (onde o webhook nunca validou assinatura), para nao atrasar a
 *   publicacao da correcao de autorizacao das rotas.
 *
 *   O que sustenta a seguranca enquanto isso: o handler NAO trata o corpo do
 *   POST como verdade. Ele reconsulta o pagamento na API oficial do Mercado
 *   Pago (fetchPayment) e deriva status/metodo/valor da resposta do provedor
 *   antes de qualquer alteracao, e a tabela WebhookEvent mantem a idempotencia.
 *   O corpo so e usado para extrair o ID a consultar.
 *
 *   Quando MP_WEBHOOK_SECRET esta presente, a validacao e obrigatoria e
 *   assinatura ausente/invalida/expirada e recusada com 401.
 *
 *   PENDENCIA: configurar MP_WEBHOOK_SECRET. Ver PENDENCIA-SEGURANCA.md.
 */

const MAX_SIGNATURE_AGE_SECONDS = 10 * 60;

let warnedMissingSecret = false;

/** Usado apenas pelos testes. */
export function resetSignatureWarningState() {
  warnedMissingSecret = false;
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) return firstString(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return undefined;
}

export function parseSignatureHeader(header: string) {
  const parts = header.split(',');
  let ts: string | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const [rawKey, ...rest] = part.split('=');
    const key = rawKey?.trim();
    const value = rest.join('=').trim();
    if (key === 'ts') ts = value;
    if (key === 'v1') v1 = value;
  }

  return { ts, v1 };
}

export function buildSignatureManifest(params: {
  dataId?: string;
  requestId?: string;
  ts?: string;
}) {
  let manifest = '';
  if (params.dataId) manifest += `id:${params.dataId};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  if (params.ts) manifest += `ts:${params.ts};`;
  return manifest;
}

export function isValidMercadoPagoSignature(params: {
  secret: string;
  signatureHeader: string | undefined;
  requestIdHeader: string | undefined;
  dataId: string | undefined;
  nowSeconds?: number;
}): boolean {
  if (!params.signatureHeader) return false;

  const { ts, v1 } = parseSignatureHeader(params.signatureHeader);
  if (!ts || !v1) return false;

  // Replay protection: assinaturas antigas sao rejeitadas.
  const tsSeconds = Number(ts.length > 10 ? ts.slice(0, 10) : ts);
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsSeconds) || Math.abs(now - tsSeconds) > MAX_SIGNATURE_AGE_SECONDS) {
    return false;
  }

  // O MP normaliza ids alfanumericos para minusculas no manifesto.
  const dataId = params.dataId ? params.dataId.toLowerCase() : undefined;
  const manifest = buildSignatureManifest({
    dataId,
    requestId: params.requestIdHeader,
    ts,
  });

  const expected = createHmac('sha256', params.secret).update(manifest).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(v1, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyMercadoPagoSignature(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.MP_WEBHOOK_SECRET;

  if (!secret) {
    // Warn-once para nao poluir o log a cada notificacao do provedor.
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        '[MP webhook] MP_WEBHOOK_SECRET nao configurado. Validacao criptografica de ' +
          'assinatura do webhook desabilitada temporariamente.',
      );
    }
    return next();
  }

  const query = req.query as Record<string, unknown>;
  const body = req.body as any;
  const dataId =
    firstString(query['data.id']) ??
    firstString(query['data_id']) ??
    firstString(query.id) ??
    firstString(body?.data?.id) ??
    firstString(body?.id);

  const valid = isValidMercadoPagoSignature({
    secret,
    signatureHeader: req.header('x-signature') ?? undefined,
    requestIdHeader: req.header('x-request-id') ?? undefined,
    dataId,
  });

  if (!valid) {
    console.warn('[MP webhook] assinatura invalida — requisicao rejeitada');
    return res.status(401).json({ message: 'Assinatura invalida' });
  }

  return next();
}
