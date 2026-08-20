const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

// Endereco morto para a API do Mercado Pago. Precisa vir ANTES de qualquer
// require de dist/, porque mercadoPagoApi le MP_API_BASE_URL no carregamento
// do modulo. Sem isso, o teste do webhook sem segredo executa o handler e faz
// chamada real ao provedor usando o token de producao do .env.
process.env.MP_API_BASE_URL = 'http://127.0.0.1:1';

const {
  assertProductionEnv,
  getMissingProductionEnv,
  getMissingRecommendedEnv,
  warnMissingRecommendedEnv,
  isProduction,
  requireEnv,
  PRODUCTION_REQUIRED_ENV,
  PRODUCTION_RECOMMENDED_ENV,
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

test('BARBER_API_KEY continua obrigatoria em producao', () => {
  const required = PRODUCTION_REQUIRED_ENV.map((item) => item.name);
  assert.ok(required.includes('BARBER_API_KEY'));
  assert.ok(required.includes('DATABASE_URL'));
  assert.ok(required.includes('MP_ACCESS_TOKEN'));
});

/**
 * TEMPORARIO E DELIBERADO: MP_WEBHOOK_SECRET e recomendada, nao obrigatoria,
 * para que a ausencia dela nao impeca o deploy da correcao de autorizacao.
 * Este teste existe para que a mudanca seja consciente: se alguem promover a
 * variavel de volta a obrigatoria, o teste falha e forca a leitura do contexto.
 * Ver PENDENCIA-SEGURANCA.md.
 */
test('MP_WEBHOOK_SECRET e recomendada (nao bloqueia startup) — pendencia registrada', () => {
  const required = PRODUCTION_REQUIRED_ENV.map((item) => item.name);
  const recommended = PRODUCTION_RECOMMENDED_ENV.map((item) => item.name);

  assert.ok(!required.includes('MP_WEBHOOK_SECRET'), 'nao pode bloquear o startup');
  assert.ok(recommended.includes('MP_WEBHOOK_SECRET'), 'deve seguir registrada como pendencia');

  // Producao sem o segredo: configuracao valida, apenas com aviso.
  const env = { ...FAKE_ENV };
  delete env.MP_WEBHOOK_SECRET;
  assert.doesNotThrow(() => assertProductionEnv(env));
  assert.deepEqual(getMissingRecommendedEnv(env), ['MP_WEBHOOK_SECRET']);
});

test('o warning de startup e claro e nao vaza valores', () => {
  const env = { ...FAKE_ENV };
  delete env.MP_WEBHOOK_SECRET;

  const lines = [];
  warnMissingRecommendedEnv(env, { warn: (m) => lines.push(m) });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /MP_WEBHOOK_SECRET nao configurado/);
  assert.match(lines[0], /desabilitada temporariamente/);
  for (const value of Object.values(FAKE_ENV)) {
    if (value === 'production') continue;
    assert.ok(!lines[0].includes(value), 'warning vazou valor de variavel');
  }

  // Com o segredo presente, nenhum aviso.
  const quiet = [];
  warnMissingRecommendedEnv({ ...FAKE_ENV }, { warn: (m) => quiet.push(m) });
  assert.deepEqual(quiet, []);
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

test('TEMPORARIO: sem MP_WEBHOOK_SECRET o webhook segue acessivel (nao 503)', async () => {
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
      // Comportamento compativel com o que ja existia em producao: a requisicao
      // passa, e o handler reconsulta o pagamento no Mercado Pago antes de
      // alterar qualquer coisa (o corpo do POST nao e fonte de verdade).
      assert.notEqual(
        response.statusCode,
        503,
        `${path} nao deve recusar por ausencia do segredo (decisao temporaria)`,
      );
      assert.notEqual(response.statusCode, 401, `${path} nao deve exigir assinatura sem segredo`);
      // Nao pode vazar dado sensivel na resposta.
      assert.ok(!/customerPhone|customerName/.test(JSON.stringify(response.json ?? {})));
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
