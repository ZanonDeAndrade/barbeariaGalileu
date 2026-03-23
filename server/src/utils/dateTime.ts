import { DateTime } from 'luxon';

export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME_ZONE_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2})$/i;

const brazilTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRAZIL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const brazilDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BRAZIL_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function assertValidDateTime(dateTime: DateTime, fieldName: string) {
  if (!dateTime.isValid) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return dateTime;
}

export function toBrazilTime(date: Date) {
  return brazilTimeFormatter.format(date);
}

export function toBrazilCalendarDate(date: Date) {
  return brazilDateFormatter.format(date);
}

export function toBrazilDate(date: Date) {
  return new Date(
    date.toLocaleString('en-US', {
      timeZone: BRAZIL_TIME_ZONE,
    }),
  );
}

export function toBrazilDateTime(value: Date | string) {
  if (value instanceof Date) {
    return assertValidDateTime(
      DateTime.fromJSDate(value, { zone: 'utc' }).setZone(BRAZIL_TIME_ZONE),
      'date',
    );
  }

  const input = value.trim();

  if (ISO_DATE_ONLY_RE.test(input)) {
    return assertValidDateTime(
      DateTime.fromISO(input, { zone: BRAZIL_TIME_ZONE }).startOf('day'),
      'date',
    );
  }

  if (ISO_TIME_ZONE_SUFFIX_RE.test(input)) {
    return assertValidDateTime(
      DateTime.fromISO(input, { setZone: true }).setZone(BRAZIL_TIME_ZONE),
      'dateTime',
    );
  }

  return assertValidDateTime(
    DateTime.fromISO(input, { zone: BRAZIL_TIME_ZONE }),
    'dateTime',
  );
}

export function parseBrazilDateTimeToUtcDate(value: Date | string, fieldName = 'dateTime') {
  return assertValidDateTime(toBrazilDateTime(value), fieldName).toUTC().toJSDate();
}

export function parseBrazilDate(value: string, fieldName = 'date') {
  const dateTime = DateTime.fromISO(value.trim(), { zone: BRAZIL_TIME_ZONE }).startOf('day');
  return assertValidDateTime(dateTime, fieldName);
}

export function getBrazilDayUtcRange(dateISO: string) {
  const day = parseBrazilDate(dateISO);

  return {
    day,
    startUtc: day.startOf('day').toUTC().toJSDate(),
    endUtc: day.endOf('day').toUTC().toJSDate(),
  };
}

export function startOfTodayInBrazilUtc() {
  return DateTime.now().setZone(BRAZIL_TIME_ZONE).startOf('day').toUTC().toJSDate();
}

export function toBrazilIsoString(date: Date) {
  const dateTime = assertValidDateTime(
    DateTime.fromJSDate(date, { zone: 'utc' }).setZone(BRAZIL_TIME_ZONE),
    'date',
  );

  const iso = dateTime.toISO({
    includeOffset: true,
    suppressMilliseconds: false,
  });

  if (!iso) {
    throw new Error('Invalid date');
  }

  return iso;
}
