const test = require('node:test');
const assert = require('node:assert/strict');

const {
  savePushSubscription,
  deactivatePushSubscription,
  sendPushToSubscriptions,
  listActiveCustomerSubscriptions,
} = require('../dist/services/pushService.js');
const {
  notifyNewAppointment,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled,
  buildBarberAppointmentUrl,
  buildCustomerAppointmentUrl,
} = require('../dist/services/appointmentNotificationService.js');
const { processDueReminders } = require('../dist/services/reminderService.js');
const { requireBarberKey } = require('../dist/middlewares/requireBarberKey.js');
const { requireBarberKeyStrict } = require('../dist/middlewares/requireBarberKeyStrict.js');
const { requireCronKey } = require('../dist/middlewares/requireCronKey.js');
const { isSafePushEndpoint, pushSubscriptionSchema } = require('../dist/schemas/push.schema.js');

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function createPushPrismaStub({ subscriptions = [], appointments = [], logs = [] } = {}) {
  const subs = subscriptions.map((s, i) => ({
    id: s.id ?? `sub_${i + 1}`,
    userType: s.userType,
    customerId: s.customerId ?? null,
    endpoint: s.endpoint,
    p256dh: s.p256dh ?? 'p256dh-key',
    auth: s.auth ?? 'auth-key',
    userAgent: s.userAgent ?? null,
    isActive: s.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const appts = appointments.map((a) => ({
    id: a.id,
    customerName: a.customerName ?? 'Cliente',
    customerPhone: a.customerPhone ?? '11999999999',
    customerId: a.customerId ?? null,
    haircutType: a.haircutType ?? 'corte-tradicional',
    notes: a.notes ?? null,
    startTime: new Date(a.startTime),
    durationMinutes: a.durationMinutes ?? 30,
    status: a.status ?? 'SCHEDULED',
    cancelledAt: a.cancelledAt ?? null,
    cancelledByRole: a.cancelledByRole ?? null,
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
    updatedAt: new Date(),
  }));

  const notifLogs = [...logs];

  const pushSubscription = {
    async findUnique({ where }) {
      return subs.find((s) => s.endpoint === where.endpoint) ?? null;
    },
    async findMany({ where }) {
      return subs.filter((s) => {
        if (where?.userType && s.userType !== where.userType) return false;
        if (where?.isActive !== undefined && s.isActive !== where.isActive) return false;
        if (where?.customerId !== undefined && s.customerId !== where.customerId) return false;
        return true;
      });
    },
    async upsert({ where, update, create }) {
      const existing = subs.find((s) => s.endpoint === where.endpoint);
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      const record = {
        id: `sub_${subs.length + 1}`,
        endpoint: where.endpoint,
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subs.push(record);
      return record;
    },
    async update({ where, data }) {
      const existing = subs.find((s) => s.endpoint === where.endpoint);
      if (!existing) throw new Error('subscription not found');
      Object.assign(existing, data, { updatedAt: new Date() });
      return existing;
    },
    async create({ data }) {
      const record = {
        id: `sub_${subs.length + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subs.push(record);
      return record;
    },
  };

  const notificationLog = {
    async create({ data }) {
      const duplicate = notifLogs.find(
        (l) =>
          l.appointmentId === data.appointmentId &&
          l.recipientType === data.recipientType &&
          l.type === data.type,
      );
      if (duplicate) {
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      }
      const record = {
        id: `log_${notifLogs.length + 1}`,
        sentAt: null,
        errorMessage: null,
        createdAt: new Date(),
        ...data,
      };
      notifLogs.push(record);
      return record;
    },
    async update({ where, data }) {
      const existing = notifLogs.find((l) => l.id === where.id);
      if (!existing) throw new Error('log not found');
      Object.assign(existing, data);
      return existing;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const l of notifLogs) {
        if (where.appointmentId && l.appointmentId !== where.appointmentId) continue;
        if (where.recipientType && l.recipientType !== where.recipientType) continue;
        if (where.type && l.type !== where.type) continue;
        if (where.status && l.status !== where.status) continue;
        if (where.createdAt?.lt && !(l.createdAt < where.createdAt.lt)) continue;
        Object.assign(l, data);
        count += 1;
      }
      return { count };
    },
    async findFirst({ where }) {
      return (
        notifLogs.find(
          (l) =>
            l.appointmentId === where.appointmentId &&
            l.recipientType === where.recipientType &&
            l.type === where.type,
        ) ?? null
      );
    },
    async delete({ where }) {
      const idx = notifLogs.findIndex((l) => l.id === where.id);
      if (idx === -1) throw new Error('log not found');
      const [removed] = notifLogs.splice(idx, 1);
      return removed;
    },
  };

  const appointment = {
    async findMany({ where }) {
      return appts
        .filter((a) => {
          if (where?.startTime?.gt && !(a.startTime > where.startTime.gt)) return false;
          if (where?.startTime?.lte && !(a.startTime <= where.startTime.lte)) return false;
          if (where?.status?.in && !where.status.in.includes(a.status)) return false;
          return true;
        })
        .sort((x, y) => x.startTime - y.startTime);
    },
  };

  return {
    prismaClient: { pushSubscription, notificationLog, appointment },
    subs,
    notifLogs,
    appts,
  };
}

function createRecordingWebPushClient() {
  const calls = [];
  return {
    calls,
    async sendNotification(subscription, payload) {
      calls.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
    },
  };
}

function createGoneWebPushClient(statusCode = 410) {
  return {
    async sendNotification() {
      const error = new Error('gone');
      error.statusCode = statusCode;
      throw error;
    },
  };
}

function createErrorWebPushClient() {
  return {
    async sendNotification() {
      throw new Error('push service unavailable');
    },
  };
}

const silentLogger = { log() {}, warn() {}, error() {} };

function minutesFromNow(minutes, base = new Date()) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

// ---------------------------------------------------------------------------
// 1. Cadastro de uma assinatura
// ---------------------------------------------------------------------------

test('cadastra uma nova assinatura push', async () => {
  const { prismaClient, subs } = createPushPrismaStub();

  const saved = await savePushSubscription(
    {
      userType: 'CUSTOMER',
      customerId: 'c1',
      endpoint: 'https://push.example.com/a',
      p256dh: 'key-a',
      auth: 'auth-a',
      userAgent: 'Test/1.0',
    },
    { prismaClient },
  );

  assert.equal(saved.isActive, true);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://push.example.com/a');
  assert.equal(subs[0].customerId, 'c1');
});

// ---------------------------------------------------------------------------
// 2. Vários dispositivos para o mesmo usuário
// ---------------------------------------------------------------------------

test('permite varios dispositivos para o mesmo cliente', async () => {
  const { prismaClient, subs } = createPushPrismaStub();

  await savePushSubscription(
    { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/1', p256dh: 'k1', auth: 'a1' },
    { prismaClient },
  );
  await savePushSubscription(
    { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/2', p256dh: 'k2', auth: 'a2' },
    { prismaClient },
  );

  const active = await listActiveCustomerSubscriptions('c1', { prismaClient });
  assert.equal(subs.length, 2);
  assert.equal(active.length, 2);
});

// ---------------------------------------------------------------------------
// 3. Atualiza assinatura existente (mesmo endpoint)
// ---------------------------------------------------------------------------

test('atualiza assinatura existente pelo mesmo endpoint', async () => {
  const { prismaClient, subs } = createPushPrismaStub({
    subscriptions: [
      {
        userType: 'CUSTOMER',
        customerId: 'c1',
        endpoint: 'https://push/1',
        p256dh: 'old',
        auth: 'old',
        isActive: false,
      },
    ],
  });

  await savePushSubscription(
    {
      userType: 'CUSTOMER',
      customerId: 'c1',
      endpoint: 'https://push/1',
      p256dh: 'new',
      auth: 'new',
    },
    { prismaClient },
  );

  assert.equal(subs.length, 1);
  assert.equal(subs[0].p256dh, 'new');
  assert.equal(subs[0].isActive, true);
});

// ---------------------------------------------------------------------------
// 4. Remove / desativa assinatura
// ---------------------------------------------------------------------------

test('desativa assinatura ao remover', async () => {
  const { prismaClient, subs } = createPushPrismaStub({
    subscriptions: [{ userType: 'BARBER', endpoint: 'https://push/b', isActive: true }],
  });

  await deactivatePushSubscription('https://push/b', { prismaClient });

  assert.equal(subs[0].isActive, false);
});

// ---------------------------------------------------------------------------
// 4b. Endpoint malicioso e rejeitado (anti-SSRF)
// ---------------------------------------------------------------------------

test('rejeita endpoints que nao sao de servicos de push reais', () => {
  assert.equal(isSafePushEndpoint('https://fcm.googleapis.com/fcm/send/abc123'), true);
  assert.equal(isSafePushEndpoint('https://web.push.apple.com/QOa9...'), true);

  assert.equal(isSafePushEndpoint('http://fcm.googleapis.com/fcm/send/abc'), false);
  assert.equal(isSafePushEndpoint('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSafePushEndpoint('https://192.168.0.10/admin'), false);
  assert.equal(isSafePushEndpoint('https://localhost/x'), false);
  assert.equal(isSafePushEndpoint('https://[::1]/x'), false);
  assert.equal(isSafePushEndpoint('https://redis.internal/x'), false);
  assert.equal(isSafePushEndpoint('https://intranet/x'), false);

  const parsed = pushSubscriptionSchema.safeParse({
    endpoint: 'https://10.0.0.1/push',
    keys: { p256dh: 'k', auth: 'a' },
  });
  assert.equal(parsed.success, false);
});

// ---------------------------------------------------------------------------
// 4c. Teto de inscricoes ativas por usuario
// ---------------------------------------------------------------------------

test('desativa inscricoes mais antigas alem do teto por usuario', async () => {
  const { prismaClient, subs } = createPushPrismaStub();

  for (let i = 0; i < 25; i += 1) {
    await savePushSubscription(
      {
        userType: 'CUSTOMER',
        customerId: 'c1',
        endpoint: `https://push.example.com/device-${i}`,
        p256dh: 'k',
        auth: 'a',
      },
      { prismaClient, logger: silentLogger },
    );
  }

  const active = subs.filter((s) => s.isActive);
  assert.equal(subs.length, 25);
  assert.equal(active.length, 20);
  // A inscricao mais recente permanece ativa.
  assert.ok(active.some((s) => s.endpoint === 'https://push.example.com/device-24'));
});

// ---------------------------------------------------------------------------
// 5. Tentativa sem autenticação (middlewares de rota protegida)
// ---------------------------------------------------------------------------

function fakeReqRes(headers = {}) {
  let statusCode = 200;
  let jsonBody = null;
  const req = {
    header: (name) => headers[name.toLowerCase()],
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
  };
  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
}

test('rota do barbeiro bloqueia sem a chave correta', () => {
  const previous = process.env.BARBER_API_KEY;
  process.env.BARBER_API_KEY = 'secret-key';
  try {
    const denied = fakeReqRes({});
    let nextCalled = false;
    requireBarberKey(denied.req, denied.res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(denied.getStatus(), 403);

    const allowed = fakeReqRes({ 'x-barber-api-key': 'secret-key' });
    let allowedNext = false;
    requireBarberKey(allowed.req, allowed.res, () => {
      allowedNext = true;
    });
    assert.equal(allowedNext, true);
  } finally {
    if (previous === undefined) delete process.env.BARBER_API_KEY;
    else process.env.BARBER_API_KEY = previous;
  }
});

test('inscricao push do barbeiro e fail-closed sem BARBER_API_KEY', () => {
  const prev = process.env.BARBER_API_KEY;
  delete process.env.BARBER_API_KEY;
  try {
    const denied = fakeReqRes({});
    let nextCalled = false;
    requireBarberKeyStrict(denied.req, denied.res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(denied.getStatus(), 403);

    process.env.BARBER_API_KEY = 'k';
    const allowed = fakeReqRes({ 'x-barber-api-key': 'k' });
    let allowedNext = false;
    requireBarberKeyStrict(allowed.req, allowed.res, () => {
      allowedNext = true;
    });
    assert.equal(allowedNext, true);
  } finally {
    if (prev === undefined) delete process.env.BARBER_API_KEY;
    else process.env.BARBER_API_KEY = prev;
  }
});

test('rota de lembretes exige chave de cron ou barbeiro', () => {
  const prevCron = process.env.PUSH_CRON_KEY;
  const prevBarber = process.env.BARBER_API_KEY;
  process.env.PUSH_CRON_KEY = 'cron-secret';
  delete process.env.BARBER_API_KEY;
  try {
    const denied = fakeReqRes({});
    let nextCalled = false;
    requireCronKey(denied.req, denied.res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(denied.getStatus(), 403);

    const allowed = fakeReqRes({ 'x-cron-key': 'cron-secret' });
    let allowedNext = false;
    requireCronKey(allowed.req, allowed.res, () => {
      allowedNext = true;
    });
    assert.equal(allowedNext, true);
  } finally {
    if (prevCron === undefined) delete process.env.PUSH_CRON_KEY;
    else process.env.PUSH_CRON_KEY = prevCron;
    if (prevBarber === undefined) delete process.env.BARBER_API_KEY;
    else process.env.BARBER_API_KEY = prevBarber;
  }
});

// ---------------------------------------------------------------------------
// 6. Novo agendamento notifica barbeiro e cliente
// ---------------------------------------------------------------------------

test('novo agendamento notifica barbeiro e cliente', async () => {
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [
      { userType: 'BARBER', endpoint: 'https://push/barber' },
      { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' },
    ],
  });
  const webPushClient = createRecordingWebPushClient();

  const appointment = {
    id: 'appt1',
    customerName: 'Joao',
    customerId: 'c1',
    haircutType: 'combo-corte-barba',
    startTime: minutesFromNow(120),
  };

  await notifyNewAppointment(appointment, { prismaClient, webPushClient, logger: silentLogger });

  assert.equal(webPushClient.calls.length, 2);
  const barberLog = notifLogs.find((l) => l.recipientType === 'BARBER' && l.type === 'NEW_APPOINTMENT');
  const customerLog = notifLogs.find(
    (l) => l.recipientType === 'CUSTOMER' && l.type === 'NEW_APPOINTMENT',
  );
  assert.ok(barberLog);
  assert.ok(customerLog);
  assert.equal(barberLog.status, 'SENT');
  assert.equal(customerLog.status, 'SENT');
});

// ---------------------------------------------------------------------------
// 7. Cancelamento notifica a outra parte
// ---------------------------------------------------------------------------

test('cancelamento pelo cliente notifica o barbeiro', async () => {
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [
      { userType: 'BARBER', endpoint: 'https://push/barber' },
      { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' },
    ],
  });
  const webPushClient = createRecordingWebPushClient();

  await notifyAppointmentCancelled(
    {
      id: 'appt1',
      customerName: 'Joao',
      customerId: 'c1',
      haircutType: 'corte-tradicional',
      startTime: minutesFromNow(120),
      cancelledByRole: 'CUSTOMER',
    },
    { prismaClient, webPushClient, logger: silentLogger },
  );

  assert.equal(webPushClient.calls.length, 1);
  assert.equal(webPushClient.calls[0].endpoint, 'https://push/barber');
  assert.equal(notifLogs[0].recipientType, 'BARBER');
  assert.equal(notifLogs[0].type, 'APPOINTMENT_CANCELLED');
});

test('cancelamento pelo barbeiro notifica o cliente', async () => {
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [
      { userType: 'BARBER', endpoint: 'https://push/barber' },
      { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' },
    ],
  });
  const webPushClient = createRecordingWebPushClient();

  await notifyAppointmentCancelled(
    {
      id: 'appt1',
      customerName: 'Joao',
      customerId: 'c1',
      haircutType: 'corte-tradicional',
      startTime: minutesFromNow(120),
      cancelledByRole: 'BARBER',
    },
    { prismaClient, webPushClient, logger: silentLogger },
  );

  assert.equal(webPushClient.calls.length, 1);
  assert.equal(webPushClient.calls[0].endpoint, 'https://push/customer');
  assert.equal(notifLogs[0].recipientType, 'CUSTOMER');
});

// ---------------------------------------------------------------------------
// 8. Reagendamento notifica o barbeiro com horario antigo e novo
// ---------------------------------------------------------------------------

test('reagendamento notifica o barbeiro com horarios antigo e novo', async () => {
  const { prismaClient } = createPushPrismaStub({
    subscriptions: [{ userType: 'BARBER', endpoint: 'https://push/barber' }],
  });
  const webPushClient = createRecordingWebPushClient();

  await notifyAppointmentRescheduled(
    {
      oldAppointment: {
        id: 'old',
        customerName: 'Joao',
        customerId: 'c1',
        haircutType: 'corte-tradicional',
        startTime: minutesFromNow(120),
      },
      newAppointment: {
        id: 'new',
        customerName: 'Joao',
        customerId: 'c1',
        haircutType: 'corte-tradicional',
        startTime: minutesFromNow(240),
      },
    },
    { prismaClient, webPushClient, logger: silentLogger },
  );

  assert.equal(webPushClient.calls.length, 1);
  const body = webPushClient.calls[0].payload.body;
  assert.match(body, /de .* para /);
  assert.equal(webPushClient.calls[0].payload.appointmentId, 'new');
});

// ---------------------------------------------------------------------------
// 9. Lembrete nao duplicado (idempotencia / concorrencia)
// ---------------------------------------------------------------------------

test('lembrete nao e enviado duas vezes', async () => {
  const now = new Date('2026-07-07T12:00:00.000Z');
  const { prismaClient } = createPushPrismaStub({
    subscriptions: [
      { userType: 'BARBER', endpoint: 'https://push/barber' },
      { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' },
    ],
    appointments: [
      {
        id: 'appt1',
        customerId: 'c1',
        status: 'CONFIRMED',
        startTime: minutesFromNow(10, now),
        createdAt: minutesFromNow(-2880, now),
      },
    ],
  });
  const webPushClient = createRecordingWebPushClient();

  const first = await processDueReminders({ prismaClient, webPushClient, logger: silentLogger, now });
  const sentAfterFirst = webPushClient.calls.length;
  assert.ok(first.sent >= 1);
  assert.ok(sentAfterFirst >= 1);

  const second = await processDueReminders({ prismaClient, webPushClient, logger: silentLogger, now });
  assert.equal(webPushClient.calls.length, sentAfterFirst);
  assert.equal(second.sent, 0);
  assert.ok(second.alreadyClaimed >= 1);
});

// ---------------------------------------------------------------------------
// 9b. Lembrete que falha e re-tentado na proxima execucao (nao queima o claim)
// ---------------------------------------------------------------------------

test('lembrete que falha e re-tentado na proxima execucao', async () => {
  const now = new Date('2026-07-07T12:00:00.000Z');
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [{ userType: 'BARBER', endpoint: 'https://push/barber' }],
    appointments: [
      {
        id: 'appt1',
        customerId: 'c1',
        status: 'CONFIRMED',
        startTime: minutesFromNow(10, now),
        createdAt: minutesFromNow(-2880, now),
      },
    ],
  });

  const failing = createErrorWebPushClient();
  const first = await processDueReminders({
    prismaClient,
    webPushClient: failing,
    logger: silentLogger,
    now,
  });
  assert.equal(first.sent, 0);
  assert.ok(first.failed >= 1);
  // Claim removido -> nenhum log terminal bloqueando nova tentativa.
  assert.equal(notifLogs.length, 0);

  const ok = createRecordingWebPushClient();
  const second = await processDueReminders({
    prismaClient,
    webPushClient: ok,
    logger: silentLogger,
    now,
  });
  assert.ok(second.sent >= 1);
  assert.ok(ok.calls.length >= 1);
});

// ---------------------------------------------------------------------------
// 9c. Sem push configurado, nenhum claim e consumido
// ---------------------------------------------------------------------------

test('execucao sem push configurado nao consome claims', async () => {
  const now = new Date('2026-07-07T12:00:00.000Z');
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [{ userType: 'BARBER', endpoint: 'https://push/barber' }],
    appointments: [
      {
        id: 'appt1',
        customerId: 'c1',
        status: 'CONFIRMED',
        startTime: minutesFromNow(10, now),
        createdAt: minutesFromNow(-2880, now),
      },
    ],
  });

  const summary = await processDueReminders({
    prismaClient,
    webPushClient: null,
    logger: silentLogger,
    now,
  });

  assert.equal(summary.sent, 0);
  assert.equal(notifLogs.length, 0);
});

// ---------------------------------------------------------------------------
// 9d. Lembrete de vespera nao dispara (tarde) quando o atendimento ja esta proximo
// ---------------------------------------------------------------------------

test('lembrete de vespera nao dispara quando o atendimento ja esta proximo', async () => {
  const now = new Date('2026-07-07T12:00:00.000Z');
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [{ userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' }],
    appointments: [
      {
        id: 'appt1',
        customerId: 'c1',
        status: 'CONFIRMED',
        startTime: minutesFromNow(30, now),
        createdAt: minutesFromNow(-4320, now),
      },
    ],
  });

  const ok = createRecordingWebPushClient();
  await processDueReminders({ prismaClient, webPushClient: ok, logger: silentLogger, now });

  const dayBefore = notifLogs.find((l) => l.type === 'REMINDER_DAY_BEFORE');
  const upcoming = notifLogs.find(
    (l) => l.type === 'REMINDER_UPCOMING' && l.recipientType === 'CUSTOMER',
  );
  assert.equal(dayBefore, undefined);
  assert.ok(upcoming);
});

// ---------------------------------------------------------------------------
// 10. Agendamento cancelado nao recebe lembrete
// ---------------------------------------------------------------------------

test('agendamento cancelado nao recebe lembrete', async () => {
  const now = new Date('2026-07-07T12:00:00.000Z');
  const { prismaClient } = createPushPrismaStub({
    subscriptions: [{ userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' }],
    appointments: [
      {
        id: 'appt1',
        customerId: 'c1',
        status: 'CANCELLED',
        startTime: minutesFromNow(10, now),
        createdAt: minutesFromNow(-2880, now),
      },
    ],
  });
  const webPushClient = createRecordingWebPushClient();

  const summary = await processDueReminders({ prismaClient, webPushClient, logger: silentLogger, now });

  assert.equal(summary.appointmentsInWindow, 0);
  assert.equal(webPushClient.calls.length, 0);
});

// ---------------------------------------------------------------------------
// 11. Endpoint expirado (410) e desativado
// ---------------------------------------------------------------------------

test('endpoint expirado (410) e desativado', async () => {
  const { prismaClient, subs } = createPushPrismaStub({
    subscriptions: [{ userType: 'BARBER', endpoint: 'https://push/gone', isActive: true }],
  });
  const webPushClient = createGoneWebPushClient(410);

  const subscription = subs[0];
  const summary = await sendPushToSubscriptions(
    [subscription],
    { title: 'Teste', body: 'corpo' },
    { prismaClient, webPushClient, logger: silentLogger },
  );

  assert.equal(summary.deactivated, 1);
  assert.equal(summary.sent, 0);
  assert.equal(subs[0].isActive, false);
});

// ---------------------------------------------------------------------------
// 12. Clique na notificacao abre a rota correta (URLs do payload)
// ---------------------------------------------------------------------------

test('URLs das notificacoes apontam para as rotas corretas', () => {
  const startTime = new Date('2026-07-10T17:00:00.000Z');
  const barberUrl = buildBarberAppointmentUrl({ id: 'appt1', startTime });
  const customerUrl = buildCustomerAppointmentUrl({ id: 'appt1' });

  assert.match(barberUrl, /appointmentId=appt1/);
  assert.match(barberUrl, /date=\d{4}-\d{2}-\d{2}/);
  assert.match(customerUrl, /view=my-appointments/);
  assert.match(customerUrl, /appointmentId=appt1/);
});

// ---------------------------------------------------------------------------
// 13. Falha no push nao desfaz o agendamento (nao lanca excecao)
// ---------------------------------------------------------------------------

test('falha no push nao propaga excecao', async () => {
  const { prismaClient, notifLogs } = createPushPrismaStub({
    subscriptions: [
      { userType: 'BARBER', endpoint: 'https://push/barber' },
      { userType: 'CUSTOMER', customerId: 'c1', endpoint: 'https://push/customer' },
    ],
  });
  const webPushClient = createErrorWebPushClient();

  await assert.doesNotReject(() =>
    notifyNewAppointment(
      {
        id: 'appt1',
        customerName: 'Joao',
        customerId: 'c1',
        haircutType: 'corte-tradicional',
        startTime: minutesFromNow(120),
      },
      { prismaClient, webPushClient, logger: silentLogger },
    ),
  );

  const barberLog = notifLogs.find((l) => l.recipientType === 'BARBER');
  assert.ok(barberLog);
  assert.equal(barberLog.status, 'FAILED');
});
