const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

const {
  assertProductionEnv,
  getMissingProductionEnv,
  isProduction,
  requireEnv,
  PRODUCTION_REQUIRED_ENV,
} = require('../dist/config/env.js');

// Valores ficticios. Nenhum segredo real entra em teste.
const FAKE_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  BARBER_API_KEY: 'fake-barber-key',
  MP_ACCESS_TOKEN: 'fake-mp-token',
  MP_WEBHOOK_SECRET: 'fake-webhook-secret',
};

// ---------------------------------------------------------------------------
// Validacao de configuracao no startup
// ---------------------------------------------------------------------------

test('producao com todas as variaveis obrigatorias nao lanca', () => {
  assert.deepEqual(getMissingProductionEnv({ ...FAKE_ENV }), []);
  assert.doesNotThrow(() => assertProductionEnv({ ...FAKE_ENV }));
});

test('cada variavel obrigatoria ausente derruba a configuracao de producao', () => {
  for (const { name } of PRODUCTION_REQUIRED_ENV) {
    const env = { ...FAKE_ENV };
    delete env[name];

    assert.deepEqual(
      getMissingProductionEnv(env),
      [name],
      `${name} deveria ser reportada como ausente`,
    );
    assert.throws(() => assertProductionEnv(env), new RegExp(name));
  }
});

test('MP_WEBHOOK_SECRET e BARBER_API_KEY sao obrigatorias em producao', () => {
  const required = PRODUCTION_REQUIRED_ENV.map((item) => item.name);
  assert.ok(required.includes('MP_WEBHOOK_SECRET'));
  assert.ok(required.includes('BARBER_API_KEY'));
});

test('variavel em branco conta como ausente', () => {
  const env = { ...FAKE_ENV, BARBER_API_KEY: '   ' };
  assert.deepEqual(getMissingProductionEnv(env), ['BARBER_API_KEY']);
});

test('fora de producao nada e exigido', () => {
  assert.equal(isProduction({ NODE_ENV: 'development' }), false);
  assert.deepEqual(getMissingProductionEnv({ NODE_ENV: 'development' }), []);
  assert.doesNotThrow(() => assertProductionEnv({ NODE_ENV: 'development' }));
});

test('a mensagem de erro nunca ecoa o valor do segredo', () => {
  const env = { ...FAKE_ENV, MP_ACCESS_TOKEN: 'super-secreto-nao-vazar' };
  delete env.BARBER_API_KEY;

  try {
    assertProductionEnv(env);
    assert.fail('deveria ter lancado');
  } catch (error) {
    assert.ok(error.message.includes('BARBER_API_KEY'));
    for (const value of Object.values(FAKE_ENV)) {
      if (value === 'production') continue;
      assert.ok(
        !error.message.includes(value),
        `a mensagem vazou o valor de uma variavel: ${value}`,
      );
    }
    assert.ok(!error.message.includes('super-secreto-nao-vazar'));
  }
});

test('requireEnv lanca sem ecoar o valor', () => {
  assert.equal(requireEnv('BARBER_API_KEY', FAKE_ENV), 'fake-barber-key');
  assert.throws(
    () => requireEnv('NAO_EXISTE', FAKE_ENV),
    /Missing required environment variable: NAO_EXISTE/,
  );
});

// ---------------------------------------------------------------------------
// Webhook fail-closed em producao
// ---------------------------------------------------------------------------

function startServer(createApp) {
  const server = createApp().listen(0);
  return once(server, 'listening').then(() => server);
}

function post(server, path, headers = {}) {
  const body = JSON.stringify({ type: 'payment', data: { id: '123' } });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        method: 'POST',
        path,
        agent: false,
        headers: { 'content-type': 'application/json', ...headers },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = null;
          }
          resolve({ statusCode: res.statusCode, json });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

test('em producao sem MP_WEBHOOK_SECRET o webhook nunca executa o handler', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.MP_WEBHOOK_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.MP_WEBHOOK_SECRET;

  // O middleware le o ambiente por requisicao, entao basta reimportar o app.
  const { createApp } = require('../dist/app.js');
  const server = await startServer(createApp);

  try {
    for (const path of ['/webhooks/mercadopago', '/api/webhook-pagamento']) {
      const response = await post(server, path);
      assert.equal(
        response.statusCode,
        503,
        `${path} deveria recusar em producao sem segredo`,
      );
      assert.equal(response.json?.code, 'WEBHOOK_SECRET_NOT_CONFIGURED');
      // O handler responderia 200 {ok:true,requestId}. Se aparecer, houve bypass.
      assert.ok(!response.json?.ok, `${path} executou o handler (fail-open)`);
    }
  } finally {
    server.close();
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete process.env.MP_WEBHOOK_SECRET;
    else process.env.MP_WEBHOOK_SECRET = previousSecret;
  }
});

test('em producao com segredo, assinatura invalida e recusada nas duas rotas', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.MP_WEBHOOK_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.MP_WEBHOOK_SECRET = 'fake-webhook-secret';

  const { createApp } = require('../dist/app.js');
  const server = await startServer(createApp);

  try {
    for (const path of ['/webhooks/mercadopago', '/api/webhook-pagamento']) {
      // Sem assinatura
      const noSignature = await post(server, path);
      assert.equal(noSignature.statusCode, 401, `${path} sem assinatura`);

      // Assinatura invalida
      const badSignature = await post(server, path, {
        'x-signature': 'ts=1800000000,v1=deadbeef',
        'x-request-id': 'req-1',
      });
      assert.equal(badSignature.statusCode, 401, `${path} com assinatura invalida`);
      assert.ok(!badSignature.json?.ok, `${path} executou o handler`);
    }
  } finally {
    server.close();
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete process.env.MP_WEBHOOK_SECRET;
    else process.env.MP_WEBHOOK_SECRET = previousSecret;
  }
});
