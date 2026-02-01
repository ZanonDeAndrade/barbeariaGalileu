const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBlockedSlotsBulk,
  deleteBlockedSlotsBulk,
} = require('../dist/services/blockedSlotService.js');

function slot(date, time) {
  return new Date(`${date}T${time}`);
}

function createPrismaStub({ blocked = [], appointments = [] } = {}) {
  const blockedSlots = blocked.map((item) => ({
    id: item.id ?? `block_${Math.random().toString(16).slice(2)}`,
    startTime: item.startTime instanceof Date ? item.startTime : new Date(item.startTime),
    reason: item.reason ?? null,
    createdAt: item.createdAt ?? new Date(),
  }));

  const appointmentsData = appointments.map((item) => ({
    id: item.id ?? `apt_${Math.random().toString(16).slice(2)}`,
    startTime: item.startTime instanceof Date ? item.startTime : new Date(item.startTime),
    status: item.status ?? 'SCHEDULED',
  }));

  return {
    data: { blockedSlots, appointments: appointmentsData },
    appointment: {
      async findMany({ where }) {
        const times = where?.startTime?.in?.map((d) => d.getTime()) ?? [];
        const statusSet = new Set(where?.status?.in ?? []);
        return appointmentsData.filter(
          (appt) => times.includes(appt.startTime.getTime()) && statusSet.has(appt.status),
        );
      },
    },
    blockedSlot: {
      async findMany({ where }) {
        if (!where?.startTime) return [...blockedSlots];
        const times = where.startTime.in?.map((d) => d.getTime()) ?? [];
        return blockedSlots.filter((item) => times.includes(item.startTime.getTime()));
      },
      async createMany({ data, skipDuplicates }) {
        for (const entry of data) {
          const exists = blockedSlots.some(
            (item) => item.startTime.getTime() === entry.startTime.getTime(),
          );
          if (exists && skipDuplicates) continue;
          blockedSlots.push({
            id: `block_${blockedSlots.length + 1}`,
            startTime: entry.startTime,
            reason: entry.reason ?? null,
            createdAt: new Date(),
          });
        }
      },
      async deleteMany({ where }) {
        const times = where.startTime.in.map((d) => d.getTime());
        let removed = 0;
        for (let i = blockedSlots.length - 1; i >= 0; i -= 1) {
          if (times.includes(blockedSlots[i].startTime.getTime())) {
            blockedSlots.splice(i, 1);
            removed += 1;
          }
        }
        return { count: removed };
      },
    },
  };
}

test('cria múltiplos bloqueios (bulk)', async () => {
  const prisma = createPrismaStub();
  const date = '2026-02-01';
  const result = await createBlockedSlotsBulk(
    { date, times: ['08:00', '08:30'], reason: 'teste' },
    { prismaClient: prisma },
  );

  assert.deepEqual(result.created.sort(), ['08:00', '08:30']);
  assert.equal(result.skipped.length, 0);
  assert.equal(prisma.data.blockedSlots.length, 2);
});

test('idempotente: segunda chamada não duplica', async () => {
  const date = '2026-02-01';
  const prisma = createPrismaStub({
    blocked: [
      { startTime: slot(date, '08:00') },
      { startTime: slot(date, '08:30') },
    ],
  });

  const result = await createBlockedSlotsBulk(
    { date, times: ['08:00', '08:30'] },
    { prismaClient: prisma },
  );

  assert.deepEqual(result.created, []);
  assert.deepEqual(
    result.skipped.map((s) => s.reason).sort(),
    ['already_blocked', 'already_blocked'],
  );
  assert.equal(prisma.data.blockedSlots.length, 2);
});

test('conflito com appointment é pulado', async () => {
  const date = '2026-02-01';
  const prisma = createPrismaStub({
    appointments: [{ startTime: slot(date, '08:00'), status: 'SCHEDULED' }],
  });

  const result = await createBlockedSlotsBulk(
    { date, times: ['08:00', '08:30'] },
    { prismaClient: prisma },
  );

  assert.deepEqual(result.created, ['08:30']);
  assert.deepEqual(result.skipped, [{ time: '08:00', reason: 'appointment_conflict' }]);
  assert.equal(prisma.data.blockedSlots.length, 1);
});

test('delete bulk remove existentes e lista notFound', async () => {
  const date = '2026-02-01';
  const prisma = createPrismaStub({
    blocked: [
      { startTime: slot(date, '08:00') },
      { startTime: slot(date, '08:30') },
    ],
  });

  const result = await deleteBlockedSlotsBulk(
    { date, times: ['08:00', '08:30', '09:00'] },
    { prismaClient: prisma },
  );

  assert.deepEqual(result.removed.sort(), ['08:00', '08:30']);
  assert.deepEqual(result.notFound, ['09:00']);
  assert.equal(prisma.data.blockedSlots.length, 0);
});
