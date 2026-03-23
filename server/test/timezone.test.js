const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBrazilDayUtcRange,
  parseBrazilDateTimeToUtcDate,
  toBrazilIsoString,
  toBrazilTime,
} = require('../dist/utils/dateTime.js');

test('interpreta data/hora sem offset como horario de Brasilia', () => {
  const parsed = parseBrazilDateTimeToUtcDate('2026-03-23T08:00:00');
  assert.equal(parsed.toISOString(), '2026-03-23T11:00:00.000Z');
});

test('calcula range do dia usando America/Sao_Paulo', () => {
  const { startUtc, endUtc } = getBrazilDayUtcRange('2026-03-23');

  assert.equal(startUtc.toISOString(), '2026-03-23T03:00:00.000Z');
  assert.equal(endUtc.toISOString(), '2026-03-24T02:59:59.999Z');
});

test('serializa datas de resposta no fuso de Brasilia', () => {
  const value = new Date('2026-03-23T11:00:00.000Z');

  assert.equal(toBrazilIsoString(value), '2026-03-23T08:00:00.000-03:00');
  assert.equal(toBrazilTime(value), '08:00');
});
