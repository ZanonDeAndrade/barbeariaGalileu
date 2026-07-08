const DEFAULT_BARBER_REMINDER_MINUTES = 15;
const DEFAULT_CUSTOMER_REMINDER_MINUTES = 60;
const DEFAULT_DAY_BEFORE_REMINDER_MINUTES = 24 * 60;
const DEFAULT_REMINDER_INTERVAL_SECONDS = 60;

function parsePositiveInt(rawValue: string | undefined, fallback: number) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export function isPushConfigured() {
  return getVapidConfig() !== null;
}

export function getBarberReminderMinutes() {
  return parsePositiveInt(process.env.PUSH_REMINDER_BARBER_MINUTES, DEFAULT_BARBER_REMINDER_MINUTES);
}

export function getCustomerReminderMinutes() {
  return parsePositiveInt(
    process.env.PUSH_REMINDER_CUSTOMER_MINUTES,
    DEFAULT_CUSTOMER_REMINDER_MINUTES,
  );
}

export function getDayBeforeReminderMinutes() {
  return parsePositiveInt(
    process.env.PUSH_REMINDER_DAY_BEFORE_MINUTES,
    DEFAULT_DAY_BEFORE_REMINDER_MINUTES,
  );
}

export function getReminderIntervalSeconds() {
  return parsePositiveInt(
    process.env.PUSH_REMINDER_INTERVAL_SECONDS,
    DEFAULT_REMINDER_INTERVAL_SECONDS,
  );
}

export function isReminderSchedulerEnabled() {
  const rawValue = (process.env.PUSH_REMINDERS_ENABLED ?? 'true').trim().toLowerCase();
  return rawValue !== 'false' && rawValue !== '0';
}
