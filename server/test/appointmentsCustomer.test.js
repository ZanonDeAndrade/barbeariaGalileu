const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cancelAppointmentByCustomer,
  rescheduleAppointmentByCustomer,
  ensureSlotsAvailable,
  SLOT_INTERVAL_MINUTES,
} = require('../dist/services/appointmentService.js');
const { HttpError } = require('../dist/utils/httpError.js');

function slotAt(hour, minute = 0, daysAhead = 1) {
  const base = new Date();
  base.setDate(base.getDate() + daysAhead);
  base.setHours(hour, minute, 0, 0);
  return base;
}

function createPrismaStub(initialAppointments = []) {
  const appointments = initialAppointments.map((item) => ({
    id: item.id,
    customerName: item.customerName ?? 'Cliente',
    customerPhone: item.customerPhone,
    customerId: item.customerId ?? null,
    haircutType: item.haircutType ?? 'cut1',
    notes: item.notes ?? null,
    startTime: new Date(item.startTime),
    durationMinutes: item.durationMinutes ?? SLOT_INTERVAL_MINUTES * 2,
    status: item.status ?? 'SCHEDULED',
    cancelledAt: item.cancelledAt ?? null,
    cancelledByRole: item.cancelledByRole ?? null,
    cancelReason: item.cancelReason ?? null,
    rescheduledFromId: item.rescheduledFromId ?? null,
    rescheduledToId: item.rescheduledToId ?? null,
    paymentStatus: item.paymentStatus ?? null,
    paymentMethod: item.paymentMethod ?? null,
    createdAt: item.createdAt ?? new Date(),
    updatedAt: item.updatedAt ?? new Date(),
    customer: item.customer ?? null,
  }));

  const appointmentApi = {
    async findUnique({ where }) {
      return appointments.find((appt) => appt.id === where.id) ?? null;
    },
    async findMany({ where }) {
      return appointments.filter((appt) => {
        if (where?.startTime?.gte && appt.startTime < where.startTime.gte) return false;
        if (where?.startTime?.lte && appt.startTime > where.startTime.lte) return false;
        if (where?.status?.in && !where.status.in.includes(appt.status)) return false;
        if (where?.status?.not && appt.status === where.status.not) return false;
        return true;
      });
    },
    async create({ data }) {
      const record = {
        id: data.id ?? `appt_${appointments.length + 1}`,
        customerName: data.customerName ?? 'Cliente',
        customerPhone: data.customerPhone,
        customerId: data.customerId ?? null,
        haircutType: data.haircutType ?? 'cut1',
        notes: data.notes ?? null,
        startTime: new Date(data.startTime),
        durationMinutes: data.durationMinutes ?? SLOT_INTERVAL_MINUTES * 2,
        status: data.status ?? 'SCHEDULED',
        cancelledAt: data.cancelledAt ?? null,
        cancelledByRole: data.cancelledByRole ?? null,
        cancelReason: data.cancelReason ?? null,
        rescheduledFromId: data.rescheduledFromId ?? null,
        rescheduledToId: data.rescheduledToId ?? null,
        paymentStatus: data.paymentStatus ?? null,
        paymentMethod: data.paymentMethod ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      appointments.push(record);
      return record;
    },
    async update({ where, data }) {
      const idx = appointments.findIndex((appt) => appt.id === where.id);
      if (idx === -1) throw new Error('Appointment not found');
      const existing = appointments[idx];
      const updated = {
        ...existing,
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : existing.startTime,
        cancelledAt:
          data.cancelledAt === null || data.cancelledAt === undefined
            ? data.cancelledAt
            : new Date(data.cancelledAt),
        updatedAt: new Date(),
      };
      appointments[idx] = updated;
      return updated;
    },
  };

  const prismaClient = {
    appointment: appointmentApi,
    blockedSlot: {
      async findMany() {
        return [];
      },
    },
    customer: {
      async findUnique() {
        return null;
      },
    },
    async $transaction(callback) {
      return callback({ appointment: appointmentApi });
    },
  };

  return { prismaClient, appointments };
}

test('cliente cancela o proprio appointment futuro', async () => {
  const startTime = slotAt(10, 0, 1);
  const { prismaClient } = createPrismaStub([
    { id: 'a1', customerPhone: '11999999999', status: 'SCHEDULED', startTime },
  ]);

  const result = await cancelAppointmentByCustomer(
    'a1',
    { phone: '11 99999-9999', reason: 'nao posso mais' },
    { prismaClient },
  );

  assert.equal(result.status, 'CANCELLED');
  assert.equal(result.cancelledByRole, 'CUSTOMER');
  assert.ok(result.cancelledAt instanceof Date);
});

test('cliente nao consegue cancelar appointment de outro phone', async () => {
  const startTime = slotAt(11, 0, 1);
  const { prismaClient, appointments } = createPrismaStub([
    { id: 'a1', customerPhone: '11999999999', status: 'SCHEDULED', startTime },
  ]);

  await assert.rejects(
    () =>
      cancelAppointmentByCustomer('a1', { phone: '11888888888' }, { prismaClient }),
    (err) =>
      err instanceof HttpError &&
      err.code === 'OWNERSHIP_MISMATCH' &&
      err.status === 403,
  );

  assert.equal(appointments[0].status, 'SCHEDULED');
});

test('remarcar cria novo e cancela antigo na mesma transacao', async () => {
  const startTime = slotAt(9, 0, 1);
  const newStart = slotAt(11, 0, 1);
  const { prismaClient, appointments } = createPrismaStub([
    {
      id: 'old',
      customerPhone: '11999999999',
      status: 'SCHEDULED',
      startTime,
      haircutType: 'cut1',
      durationMinutes: 60,
    },
  ]);

  const { newAppointment, oldAppointment } = await rescheduleAppointmentByCustomer(
    'old',
    { phone: '11999999999', newStartTime: newStart.toISOString(), reason: 'Preciso mudar' },
    { prismaClient },
  );

  assert.equal(appointments.length, 2);
  assert.equal(oldAppointment.status, 'CANCELLED');
  assert.equal(oldAppointment.cancelledByRole, 'CUSTOMER');
  assert.equal(oldAppointment.rescheduledToId, newAppointment.id);
  assert.equal(newAppointment.rescheduledFromId, 'old');
  assert.equal(new Date(newAppointment.startTime).getTime(), newStart.getTime());
});

test('remarcar com conflito retorna 409 e mantem antigo ativo', async () => {
  const targetSlot = slotAt(11, 0, 1);
  const oldSlot = slotAt(9, 0, 1);
  const { prismaClient, appointments } = createPrismaStub([
    { id: 'old', customerPhone: '11999999999', status: 'SCHEDULED', startTime: oldSlot },
    { id: 'other', customerPhone: '11777777777', status: 'SCHEDULED', startTime: targetSlot },
  ]);

  await assert.rejects(
    () =>
      rescheduleAppointmentByCustomer(
        'old',
        { phone: '11999999999', newStartTime: targetSlot.toISOString() },
        { prismaClient },
      ),
    (err) =>
      err instanceof HttpError &&
      err.code === 'HORARIO_INDISPONIVEL' &&
      err.status === 409,
  );

  const old = appointments.find((appt) => appt.id === 'old');
  assert.equal(old.status, 'SCHEDULED');
  assert.equal(appointments.length, 2);
});

test('horario cancelado volta a ficar livre', async () => {
  const slot = slotAt(15, 0, 1);
  const { prismaClient } = createPrismaStub([
    { id: 'c1', customerPhone: '11999999999', status: 'CANCELLED', startTime: slot },
  ]);

  await assert.doesNotReject(() => ensureSlotsAvailable([slot], prismaClient));
});

test('pagamento aprovado bloqueia cancelamento e remarcacao pelo cliente', async () => {
  const slot = slotAt(10, 0, 1);
  const { prismaClient, appointments } = createPrismaStub([
    {
      id: 'paid',
      customerPhone: '11999999999',
      status: 'SCHEDULED',
      startTime: slot,
      paymentStatus: 'approved',
    },
  ]);

  await assert.rejects(
    () => cancelAppointmentByCustomer('paid', { phone: '11999999999' }, { prismaClient }),
    (err) => err instanceof HttpError && err.code === 'PAYMENT_ALREADY_PAID',
  );

  await assert.rejects(
    () =>
      rescheduleAppointmentByCustomer(
        'paid',
        { phone: '11999999999', newStartTime: slotAt(12, 0, 1).toISOString() },
        { prismaClient },
      ),
    (err) => err instanceof HttpError && err.code === 'PAYMENT_ALREADY_PAID',
  );

  assert.equal(appointments[0].status, 'SCHEDULED');
});
