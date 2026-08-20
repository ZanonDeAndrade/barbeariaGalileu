import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env.js';

/**
 * Valida a assinatura x-signature do Mercado Pago.
 *
 * Manifesto assinado pelo MP: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (partes ausentes sao omitidas). O HMAC-SHA256 usa o "segredo do webhook" do
 * painel do Mercado Pago.
 *
 * Comportamento quando MP_WEBHOOK_SECRET nao esta configurada:
 *
 *   producao  -> FAIL-CLOSED. Responde 503 e NUNCA executa o handler. Na
 *                pratica esta ramificacao e inalcancavel, porque
 *                assertProductionEnv() ja impede o processo de subir sem o
 *                segredo; ela existe como defesa em profundidade.
 *   dev/teste -> segue, apenas avisando, para nao exigir o segredo real em
 *                ambiente local.
 */

const MAX_SIGNATURE_AGE_SECONDS = 10 * 60;

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
    if (isProduction()) {
      console.error(
        '[MP webhook] MP_WEBHOOK_SECRET ausente em producao — requisicao rejeitada.',
      );
      return res.status(503).json({
        message: 'Webhook indisponivel',
        code: 'WEBHOOK_SECRET_NOT_CONFIGURED',
      });
    }

    console.warn(
      '[MP webhook] MP_WEBHOOK_SECRET nao configurado (dev): assinatura nao verificada.',
    );
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
