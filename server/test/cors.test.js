const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

const { createApp } = require('../dist/app.js');

function startServer() {
  const server = createApp().listen(0);
  return once(server, 'listening').then(() => server);
}

function request(server, { method, path = '/', headers = {} }) {
  const address = server.address();

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        method,
        path,
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

test('preflight libera origem confiavel da Vercel', async () => {
  const server = await startServer();

  try {
    const origin = 'https://barbearia-galileu-st53.vercel.app';
    const response = await request(server, {
      method: 'OPTIONS',
      path: '/api/appointments/by-phone',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-request-id',
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
    assert.match(response.headers['access-control-allow-methods'], /PATCH/);
    assert.match(response.headers['access-control-allow-headers'], /X-Request-Id/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('origem nao confiavel recebe 403', async () => {
  const server = await startServer();

  try {
    const response = await request(server, {
      method: 'GET',
      path: '/health',
      headers: {
        Origin: 'https://evil.example.com',
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
    assert.match(response.body, /Not allowed by CORS/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
