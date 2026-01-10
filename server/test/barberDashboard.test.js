const test = require('node:test');
const assert = require('node:assert/strict');

const { getMonthlyAppointmentsSummary } = require('../dist/services/barberDashboardService.js');

function createInMemoryPrisma(initialAppointments) {
  const appointments = initialAppointments.map((item) => ({
    ...item,
    startTime: item.startTime instanceof Date ? item.startTime : new Date(item.startTime),
  }));

  const filterAppointments = (where) => {
    const range = where?.startTime ?? {};
    const start = range.gte;
    const end = range.lt;
    const statusNot = where?.status?.not;

    return appointments.filter((appointment) => {
      if (start && appointment.startTime < start) return false;
      if (end && appointment.startTime >= end) return false;
      if (statusNot && appointment.status === statusNot) return false;
      return true;
    });
  };

  return {
    async $transaction(operations) {
      return Promise.all(operations);
    },
    appointment: {
      async count({ where }) {
        return filterAppointments(where).length;
      },
      async aggregate({ where }) {
        return { _count: { id: filterAppointments(where).length } };
      },
      async groupBy({ by, where, orderBy }) {
        const key = by[0];
        const list = filterAppointments(where);
        const counts = new Map();

        for (const appointment of list) {
          const value = appointment[key];
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }

        const rows = Array.from(counts.entries()).map(([value, count]) => ({
          [key]: value,
          _count: { id: count },
        }));

        const direction = orderBy?._count?.id ?? 'desc';
        if (direction === 'desc') {
          rows.sort((a, b) => b._count.id - a._count.id);
        } else {
          rows.sort((a, b) => a._count.id - b._count.id);
        }

        return rows;
      },
    },
  };
}

test('dashboard summary respeita mês em America/Sao_Paulo e filtra cancelados', async () => {
  const prisma = createInMemoryPrisma([
    // Dezembro (Sao Paulo): 2026-01-01T02:59:59Z == 2025-12-31T23:59:59-03 (fora de janeiro)
    { id: 'dec', startTime: '2026-01-01T02:59:59Z', haircutType: 'cut3', status: 'SCHEDULED' },
    // Janeiro (Sao Paulo): início exato do mês
    { id: 'a1', startTime: '2026-01-01T03:00:00Z', haircutType: 'cut1', status: 'SCHEDULED' },
    { id: 'a2', startTime: '2026-01-15T12:00:00Z', haircutType: 'cut1', status: 'CONFIRMED' },
    { id: 'a3', startTime: '2026-01-20T15:00:00Z', haircutType: 'cut2', status: 'CANCELLED' },
    // Último segundo de janeiro em Sao Paulo: 2026-02-01T02:59:59Z == 2026-01-31T23:59:59-03 (inclui)
    { id: 'a4', startTime: '2026-02-01T02:59:59Z', haircutType: 'cut2', status: 'SCHEDULED' },
    // Fevereiro (Sao Paulo): 2026-02-01T03:00:00Z == 2026-02-01T00:00:00-03 (fora de janeiro)
    { id: 'feb', startTime: '2026-02-01T03:00:00Z', haircutType: 'cut2', status: 'SCHEDULED' },
  ]);

  const summary = await getMonthlyAppointmentsSummary(
    { month: '2026-01', includeCanceled: false },
    { prismaClient: prisma },
  );

  assert.equal(summary.month, '2026-01');
  assert.equal(summary.total, 3);

  assert.deepEqual(summary.byService, [
    { haircutType: 'cut1', count: 2 },
    { haircutType: 'cut2', count: 1 },
  ]);
});

test('dashboard summary inclui cancelados quando includeCanceled=true', async () => {
  const prisma = createInMemoryPrisma([
    { id: 'a1', startTime: '2026-01-01T03:00:00Z', haircutType: 'cut1', status: 'SCHEDULED' },
    { id: 'a2', startTime: '2026-01-15T12:00:00Z', haircutType: 'cut1', status: 'CONFIRMED' },
    { id: 'a3', startTime: '2026-01-20T15:00:00Z', haircutType: 'cut2', status: 'CANCELLED' },
    { id: 'a4', startTime: '2026-02-01T02:59:59Z', haircutType: 'cut2', status: 'SCHEDULED' },
  ]);

  const summary = await getMonthlyAppointmentsSummary(
    { month: '2026-01', includeCanceled: true },
    { prismaClient: prisma },
  );

  assert.equal(summary.total, 4);

  assert.deepEqual(summary.byService, [
    { haircutType: 'cut1', count: 2 },
    { haircutType: 'cut2', count: 2 },
  ]);
});
