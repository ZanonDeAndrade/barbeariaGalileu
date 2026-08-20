const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const { resolvePriceForHaircut } = require('../dist/controllers/payments.controller.js');
const { pickAllowedCardPayload } = require('../dist/services/payments.service.js');
const {
  isValidMercadoPagoSignature,
  parseSignatureHeader,
} = require('../dist/middlewares/verifyMercadoPagoSignature.js');
const { listHaircutOptions } = require('../dist/services/haircutService.js');

// ---------------------------------------------------------------------------
// Preco do servico e sempre do servidor
// ---------------------------------------------------------------------------

test('preco vem do catalogo do servidor, nao do payload do cliente', () => {
  for (const haircut of listHaircutOptions()) {
    const resolved = resolvePriceForHaircut(haircut.id);
    assert.equal(resolved.amount, haircut.priceCents / 100);
    assert.equal(resolved.description, haircut.name);
  }
});

test('tipo de corte desconhecido nao gera cobranca', () => {
  assert.throws(
    () => resolvePriceForHaircut('corte-inventado'),
    (error) => error.status === 400 && error.code === 'INVALID_HAIRCUT',
  );
});

test('cardPayload do navegador nao sobrescreve valor nem metadados', () => {
  const hostile = {
    token: 'card-token',
    issuer_id: '24',
    payment_method_id: 'visa',
    payer: { email: 'cliente@example.com' },
    // Campos que o atacante tentaria injetar:
    transaction_amount: 0.01,
    installments: 12,
    external_reference: 'outro-agendamento',
    metadata: { appointmentId: 'outro-agendamento' },
    notification_url: 'https://attacker.example.com/hook',
    description: 'Gratis',
  };

  const picked = pickAllowedCardPayload(hostile);

  assert.deepEqual(Object.keys(picked).sort(), [
    'issuer_id',
    'payer',
    'payment_method_id',
    'token',
  ]);
  for (const forbidden of [
    'transaction_amount',
    'installments',
    'external_reference',
    'metadata',
    'notification_url',
    'description',
  ]) {
    assert.ok(!(forbidden in picked), `${forbidden} nao pode passar do cliente`);
  }
});

// ---------------------------------------------------------------------------
// Assinatura do webhook do Mercado Pago
// ---------------------------------------------------------------------------

const SECRET = 'webhook-secret';

function signedHeader(params) {
  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${params.ts};`;
  const v1 = createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${params.ts},v1=${v1}`;
}

test('parseSignatureHeader extrai ts e v1', () => {
  assert.deepEqual(parseSignatureHeader('ts=123,v1=abc'), { ts: '123', v1: 'abc' });
  assert.deepEqual(parseSignatureHeader('lixo'), { ts: undefined, v1: undefined });
});

test('assinatura valida do Mercado Pago e aceita', () => {
  const nowSeconds = 1_800_000_000;
  const ts = String(nowSeconds);
  assert.equal(
    isValidMercadoPagoSignature({
      secret: SECRET,
      signatureHeader: signedHeader({ dataId: '123', requestId: 'req-1', ts }),
      requestIdHeader: 'req-1',
      dataId: '123',
      nowSeconds,
    }),
    true,
  );
});

test('assinatura ausente, adulterada ou com segredo errado e recusada', () => {
  const nowSeconds = 1_800_000_000;
  const ts = String(nowSeconds);
  const valid = signedHeader({ dataId: '123', requestId: 'req-1', ts });

  const base = { secret: SECRET, requestIdHeader: 'req-1', dataId: '123', nowSeconds };

  assert.equal(isValidMercadoPagoSignature({ ...base, signatureHeader: undefined }), false);
  assert.equal(isValidMercadoPagoSignature({ ...base, signatureHeader: 'ts=1,v1=deadbeef' }), false);
  // Mesma assinatura, mas para outro pagamento -> nao serve.
  assert.equal(isValidMercadoPagoSignature({ ...base, signatureHeader: valid, dataId: '456' }), false);
  // Mesma assinatura, outro request-id -> nao serve.
  assert.equal(
    isValidMercadoPagoSignature({ ...base, signatureHeader: valid, requestIdHeader: 'req-2' }),
    false,
  );
  assert.equal(
    isValidMercadoPagoSignature({ ...base, signatureHeader: valid, secret: 'outro-segredo' }),
    false,
  );
});

test('assinatura antiga e recusada (replay)', () => {
  const signedAt = 1_800_000_000;
  const ts = String(signedAt);
  const header = signedHeader({ dataId: '123', requestId: 'req-1', ts });

  assert.equal(
    isValidMercadoPagoSignature({
      secret: SECRET,
      signatureHeader: header,
      requestIdHeader: 'req-1',
      dataId: '123',
      nowSeconds: signedAt + 11 * 60,
    }),
    false,
  );
});
