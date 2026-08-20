const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

// A chave precisa existir ANTES de carregar o app (dotenv nao sobrescreve o
// que ja esta no ambiente), senao o requireBarber responderia sempre
// BARBER_KEY_MISSING e os testes de 401/403 ficariam sem valor.
process.env.BARBER_API_KEY = 'test-barber-key';

const { createApp } = require('../dist/app.js');
const { resetBarberAuthThrottle } = require('../dist/middlewares/requireBarber.js');

const VALID_KEY = 'test-barber-key';

function startServer() {
  const server = createApp().listen(0);
  return once(server, 'listening').then(() => server);
}

function request(server, { method, path, headers = {}, body }) {
  const address = server.address();
  const payload = body === undefined ? null : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        method,
        path,
        // agent:false -> uma conexao por requisicao. Com keep-alive o socket e
        // reaproveitado e o servidor pode fecha-lo apos uma negativa, o que
        // apareceria como ECONNRESET no meio da suite.
        agent: false,
        headers: {
          ...(payload ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = null;
          }
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
        });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Inventario das rotas que exigem a identidade do barbeiro.
 *
 * Toda rota nova que leia ou altere dados da barbearia deve entrar aqui. Os
 * casos negativos (sem chave / chave errada) sao rejeitados no middleware,
 * antes de qualquer acesso ao banco, entao a suite roda sem banco de dados.
 */
const BARBER_ROUTES = [
  { method: 'GET', path: '/api/appointments' },
  { method: 'PATCH', path: '/api/appointments/abc123/cancel', body: {} },
  { method: 'GET', path: '/api/barber/dashboard/appointments-summary?month=2026-08' },
  { method: 'GET', path: '/api/barber/session' },
  { method: 'POST', path: '/api/barber/blocked-slots/bulk', body: { date: '2026-08-20', times: ['09:00'] } },
  { method: 'DELETE', path: '/api/barber/blocked-slots/bulk', body: { date: '2026-08-20', times: ['09:00'] } },
  { method: 'GET', path: '/api/blocked-slots' },
  { method: 'POST', path: '/api/blocked-slots', body: { startTime: '2026-08-20T09:00' } },
  { method: 'DELETE', path: '/api/blocked-slots/abc123' },
  { method: 'POST', path: '/api/barber/payments/123/sync' },
  { method: 'POST', path: '/api/push/barber/subscribe', body: {} },
];

// Rotas que precisam continuar acessiveis sem credencial (fluxo do cliente).
// Servem de guarda contra um "protege tudo" que quebraria o app do cliente.
const PUBLIC_ROUTES = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/haircuts' },
];

test('rotas do barbeiro respondem 401 sem credencial', async () => {
  resetBarberAuthThrottle();
  const server = await startServer();
  try {
    for (const route of BARBER_ROUTES) {
      const response = await request(server, route);
      assert.equal(
        response.statusCode,
        401,
        `${route.method} ${route.path} deveria responder 401 sem chave, respondeu ${response.statusCode}`,
      );
      assert.equal(response.json?.code, 'BARBER_KEY_REQUIRED');
      // Nao pode vazar dado algum junto com a negativa.
      assert.ok(!/customerPhone|customerName/.test(response.body));
    }
  } finally {
    server.close();
  }
});

test('rotas do barbeiro respondem 403 com credencial invalida', async () => {
  resetBarberAuthThrottle();
  const server = await startServer();
  try {
    for (const route of BARBER_ROUTES) {
      const response = await request(server, {
        ...route,
        headers: { 'x-barber-api-key': 'chave-errada' },
      });
      assert.equal(
        response.statusCode,
        403,
        `${route.method} ${route.path} deveria responder 403 com chave errada, respondeu ${response.statusCode}`,
      );
      assert.equal(response.json?.code, 'BARBER_KEY_INVALID');
    }
  } finally {
    server.close();
  }
});

test('chave valida passa pela autorizacao (nao responde 401/403)', async () => {
  resetBarberAuthThrottle();
  const server = await startServer();
  try {
    // GET /api/barber/session nao toca o banco: e a prova de que a chave certa
    // realmente atravessa o middleware.
    const response = await request(server, {
      method: 'GET',
      path: '/api/barber/session',
      headers: { 'x-barber-api-key': VALID_KEY },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json, { ok: true });
  } finally {
    server.close();
  }
});

test('bypass por variacao de caminho nao contorna a autorizacao', async () => {
  resetBarberAuthThrottle();
  const server = await startServer();
  try {
    const variants = [
      '/api/appointments/',
      '/api/APPOINTMENTS',
      '/api/appointments/../appointments',
      '/api/appointments%2F',
      '/api//appointments',
      '/api/blocked-slots/',
      '/api/barber/dashboard/appointments-summary/?month=2026-08',
    ];

    for (const path of variants) {
      const response = await request(server, { method: 'GET', path });
      assert.ok(
        [401, 403, 404].includes(response.statusCode),
        `GET ${path} deveria ser negado, respondeu ${response.statusCode}`,
      );
      assert.ok(
        !/customerPhone|customerName/.test(response.body),
        `GET ${path} vazou dados de agendamento`,
      );
    }
  } finally {
    server.close();
  }
});

test('metodo alternativo nao expoe a lista de agendamentos', async () => {
  const server = await startServer();
  try {
    for (const method of ['HEAD', 'OPTIONS']) {
      const response = await request(server, { method, path: '/api/appointments' });
      assert.ok(
        !/customerPhone|customerName/.test(response.body),
        `${method} /api/appointments vazou dados`,
      );
    }
  } finally {
    server.close();
  }
});

test('rotas publicas continuam acessiveis sem credencial', async () => {
  const server = await startServer();
  try {
    for (const route of PUBLIC_ROUTES) {
      const response = await request(server, route);
      assert.equal(
        response.statusCode,
        200,
        `${route.method} ${route.path} deveria continuar publica, respondeu ${response.statusCode}`,
      );
    }
  } finally {
    server.close();
  }
});

test('sem BARBER_API_KEY configurada a area do barbeiro fica fechada', async () => {
  const previous = process.env.BARBER_API_KEY;
  delete process.env.BARBER_API_KEY;
  const server = await startServer();
  try {
    const response = await request(server, {
      method: 'GET',
      path: '/api/appointments',
      headers: { 'x-barber-api-key': VALID_KEY },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json?.code, 'BARBER_KEY_MISSING');
  } finally {
    server.close();
    process.env.BARBER_API_KEY = previous;
  }
});

test('respostas trazem cabecalhos de seguranca', async () => {
  const server = await startServer();
  try {
    const response = await request(server, { method: 'GET', path: '/api/haircuts' });
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert.ok(String(response.headers['content-security-policy']).includes("frame-ancestors 'none'"));
  } finally {
    server.close();
  }
});

test('brute force da chave do barbeiro e contido', async () => {
  resetBarberAuthThrottle();
  const server = await startServer();
  try {
    let sawThrottle = false;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request(server, {
        method: 'GET',
        path: '/api/barber/session',
        headers: { 'x-barber-api-key': `tentativa-${attempt}` },
      });

      if (response.statusCode === 429) {
        sawThrottle = true;
        assert.equal(response.json?.code, 'TOO_MANY_ATTEMPTS');
        break;
      }
      assert.equal(response.statusCode, 403);
    }

    assert.ok(sawThrottle, 'tentativas repetidas com chave errada nao foram limitadas');

    // A chave certa continua funcionando? Nao: enquanto a janela dura, o IP
    // fica bloqueado. O importante e que o bloqueio seja por identidade de
    // cliente e nao dependa de header enviado pelo atacante (proximo teste).
  } finally {
    server.close();
    resetBarberAuthThrottle();
  }
});

test('contador de tentativas nao e zerado pelo X-Forwarded-For do atacante', async () => {
  resetBarberAuthThrottle();
  const server = await startServer();
  try {
    let sawThrottle = false;

    // Cadeia como a de producao: o proxy confiavel (trust proxy = 1) acrescenta
    // o IP real ao final. O atacante controla apenas o inicio da lista e troca
    // esse valor a cada requisicao. A versao anterior do limitador lia
    // justamente o PRIMEIRO valor, entao o contador nunca subia.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request(server, {
        method: 'GET',
        path: '/api/barber/session',
        headers: {
          'x-barber-api-key': `tentativa-${attempt}`,
          'x-forwarded-for': `198.51.100.${attempt % 250}, 203.0.113.7`,
        },
      });

      if (response.statusCode === 429) {
        sawThrottle = true;
        break;
      }
      assert.equal(response.statusCode, 403);
    }

    assert.ok(sawThrottle, 'X-Forwarded-For forjado contornou a contencao de brute force');
  } finally {
    server.close();
    resetBarberAuthThrottle();
  }
});
