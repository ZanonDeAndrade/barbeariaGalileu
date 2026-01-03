const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMercadoPagoWebhookHandler,
} = require('../dist/controllers/mercadopagoWebhookController.js');

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createInMemoryPrisma(initialAppointments = []) {
  const appointments = new Map(initialAppointments.map((item) => [item.id, { ...item }]));
  const webhookEvents = [];
  let webhookCreateError = null;

  return {
    data: { appointments, webhookEvents },
    setWebhookCreateError(error) {
      webhookCreateError = error;
    },
    appointment: {
      async findUnique({ where }) {
        if (!where?.id) return null;
        return appointments.get(where.id) ?? null;
      },
      async findFirst({ where }) {
        const target = where?.mpPaymentId;
        if (!target) return null;
        for (const appointment of appointments.values()) {
          if (appointment.mpPaymentId === target) return appointment;
        }
        return null;
      },
      async update({ where, data }) {
        const current = appointments.get(where.id);
        if (!current) throw new Error('Appointment not found');
        const updated = { ...current, ...data };
        appointments.set(where.id, updated);
        return updated;
      },
    },
    webhookEvent: {
      async create(args) {
        if (webhookCreateError) {
          throw webhookCreateError;
        }
        webhookEvents.push(args);
        return args;
      },
    },
  };
}

const silentLogger = {
  log() {},
  warn() {},
  error() {},
};

test('webhook type=payment atualiza appointment para approved', async () => {
  const prisma = createInMemoryPrisma([
    { id: 'apt1', status: 'SCHEDULED', paymentStatus: 'pending', paymentMethod: 'pix', mpPaymentId: null },
  ]);

  const mpApi = {
    async fetchPayment(paymentId) {
      assert.equal(paymentId, '123');
      return {
        id: '123',
        status: 'approved',
        status_detail: 'accredited',
        metadata: { appointmentId: 'apt1' },
        external_reference: null,
        payment_method_id: 'pix',
      };
    },
    async fetchMerchantOrder() {
      throw new Error('not used');
    },
  };

  const handler = createMercadoPagoWebhookHandler({ prismaClient: prisma, mpApi, logger: silentLogger });

  const req = {
    method: 'POST',
    path: '/webhooks/mercadopago',
    query: { type: 'payment', 'data.id': '123' },
    headers: { 'user-agent': 'test' },
    body: {},
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);

  const updated = prisma.data.appointments.get('apt1');
  assert.equal(updated.paymentStatus, 'approved');
  assert.equal(updated.paymentMethod, 'pix');
  assert.equal(updated.mpPaymentId, '123');
  assert.equal(updated.status, 'CONFIRMED');

  assert.equal(prisma.data.webhookEvents.length, 1);
  const eventArgs = prisma.data.webhookEvents[0];
  assert.equal(eventArgs.data.provider, 'MERCADOPAGO');
  assert.equal(eventArgs.data.relatedProviderPaymentId, '123');
  assert.equal(eventArgs.data.processingStatus, 'SUCCESS');
});

test('webhook idempotente: erro P2002 não quebra processamento', async () => {
  const prisma = createInMemoryPrisma([
    { id: 'apt1', status: 'SCHEDULED', paymentStatus: 'pending', paymentMethod: 'pix', mpPaymentId: null },
  ]);

  const mpApi = {
    async fetchPayment() {
      return {
        id: '123',
        status: 'approved',
        status_detail: null,
        metadata: { appointmentId: 'apt1' },
        external_reference: null,
        payment_method_id: 'pix',
      };
    },
    async fetchMerchantOrder() {
      throw new Error('not used');
    },
  };

  const handler = createMercadoPagoWebhookHandler({ prismaClient: prisma, mpApi, logger: silentLogger });

  const req = {
    method: 'POST',
    path: '/webhooks/mercadopago',
    query: { type: 'payment', 'data.id': '123' },
    headers: {},
    body: {},
  };

  await handler(req, createMockRes());

  prisma.setWebhookCreateError({ code: 'P2002' });
  const res2 = createMockRes();
  await handler(req, res2);
  assert.equal(res2.statusCode, 200);

  const updated = prisma.data.appointments.get('apt1');
  assert.equal(updated.paymentStatus, 'approved');
  assert.equal(updated.mpPaymentId, '123');
});

test('webhook topic=merchant_order resolve payment e atualiza appointment', async () => {
  const prisma = createInMemoryPrisma([
    { id: 'apt1', status: 'SCHEDULED', paymentStatus: 'pending', paymentMethod: 'pix', mpPaymentId: null },
  ]);

  const mpApi = {
    async fetchMerchantOrder(orderId) {
      assert.equal(orderId, '999');
      return { payments: [{ id: '123', status: 'approved' }] };
    },
    async fetchPayment(paymentId) {
      assert.equal(paymentId, '123');
      return {
        id: '123',
        status: 'approved',
        status_detail: null,
        metadata: { appointmentId: 'apt1' },
        external_reference: null,
        payment_method_id: 'pix',
      };
    },
  };

  const handler = createMercadoPagoWebhookHandler({ prismaClient: prisma, mpApi, logger: silentLogger });

  const req = {
    method: 'POST',
    path: '/webhooks/mercadopago',
    query: { topic: 'merchant_order', id: '999' },
    headers: {},
    body: {},
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const updated = prisma.data.appointments.get('apt1');
  assert.equal(updated.paymentStatus, 'approved');
  assert.equal(updated.mpPaymentId, '123');
});

test('merchant_order sem pagamentos é IGNORED', async () => {
  const prisma = createInMemoryPrisma([
    { id: 'apt1', status: 'SCHEDULED', paymentStatus: 'pending', paymentMethod: 'pix', mpPaymentId: null },
  ]);

  const mpApi = {
    async fetchMerchantOrder() {
      return { payments: [] };
    },
    async fetchPayment() {
      throw new Error('not used');
    },
  };

  const handler = createMercadoPagoWebhookHandler({ prismaClient: prisma, mpApi, logger: silentLogger });

  const req = {
    method: 'POST',
    path: '/webhooks/mercadopago',
    query: { topic: 'merchant_order', id: '999' },
    headers: {},
    body: {},
  };
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const updated = prisma.data.appointments.get('apt1');
  assert.equal(updated.paymentStatus, 'pending');
  assert.equal(prisma.data.webhookEvents.length, 1);
  assert.equal(prisma.data.webhookEvents[0].data.processingStatus, 'IGNORED');
});

