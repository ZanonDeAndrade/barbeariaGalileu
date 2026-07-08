import { api, apiBaseURL } from './api';

const PUSH_CONTEXT_CACHE = 'push-config';
const PUSH_CONTEXT_KEY = '/__push_context__';

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: 'unsupported' | 'ios-needs-install' };

export type EnableResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'unsupported'
        | 'ios-needs-install'
        | 'permission-denied'
        | 'not-configured'
        | 'barber-key-missing'
        | 'barber-auth-failed'
        | 'error';
    };

function barberApiKey(): string | undefined {
  const key = (import.meta as any).env.VITE_BARBER_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : undefined;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function detectSupport(): PushSupport {
  const hasApis =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window;

  if (!hasApis) {
    // iOS so expoe as APIs de push quando o app esta instalado (A2HS).
    if (isIos() && !isStandalone()) {
      return { supported: false, reason: 'ios-needs-install' };
    }
    return { supported: false, reason: 'unsupported' };
  }

  if (isIos() && !isStandalone()) {
    return { supported: false, reason: 'ios-needs-install' };
  }

  return { supported: true };
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const response = await api.get<{ publicKey: string }>('/push/public-key');
    return response.data.publicKey ?? null;
  } catch (error) {
    return null;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) {
    await navigator.serviceWorker.ready;
    return existing;
  }
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (detectSupport().supported !== true) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    return null;
  }
}

export async function isEnabled(): Promise<boolean> {
  const subscription = await getExistingSubscription();
  return Boolean(subscription);
}

async function storePushContext(vapidPublicKey: string) {
  try {
    const cache = await caches.open(PUSH_CONTEXT_CACHE);
    const context = {
      vapidPublicKey,
      subscribeUrl: `${apiBaseURL}/push/barber/subscribe`,
      headers: barberApiKey() ? { 'x-barber-api-key': barberApiKey() } : {},
      extra: {},
    };
    await cache.put(
      PUSH_CONTEXT_KEY,
      new Response(JSON.stringify(context), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch (error) {
    // Contexto e opcional (usado apenas para re-inscricao automatica).
  }
}

async function clearPushContext() {
  try {
    const cache = await caches.open(PUSH_CONTEXT_CACHE);
    await cache.delete(PUSH_CONTEXT_KEY);
  } catch (error) {
    // ignore
  }
}

/**
 * Regrava o contexto de re-inscricao caso ele tenha sido perdido
 * (ex.: usuario ativou as notificacoes antes de uma atualizacao do SW).
 */
export async function ensurePushContext(): Promise<void> {
  try {
    if (!(await isEnabled())) return;
    const cache = await caches.open(PUSH_CONTEXT_CACHE);
    const existing = await cache.match(PUSH_CONTEXT_KEY);
    if (existing) return;
    const publicKey = await fetchPublicKey();
    if (!publicKey) return;
    await storePushContext(publicKey);
  } catch (error) {
    // Contexto e opcional; falha aqui nao afeta o funcionamento atual.
  }
}

export async function enablePush(): Promise<EnableResult> {
  const support = detectSupport();
  if (support.supported !== true) {
    return { ok: false, reason: support.reason };
  }

  let permission = getPermission();
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission === 'denied') {
    return { ok: false, reason: 'permission-denied' };
  }
  if (permission !== 'granted') {
    return { ok: false, reason: 'error' };
  }

  const publicKey = await fetchPublicKey();
  if (!publicKey) {
    return { ok: false, reason: 'not-configured' };
  }

  const apiKey = barberApiKey();
  if (!apiKey) {
    return { ok: false, reason: 'barber-key-missing' };
  }

  try {
    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.post(
      '/push/barber/subscribe',
      {
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      },
      { headers: { 'x-barber-api-key': apiKey } },
    );

    await storePushContext(publicKey);
    return { ok: true };
  } catch (error) {
    if ((error as any)?.response?.status === 403) {
      return { ok: false, reason: 'barber-auth-failed' };
    }
    return { ok: false, reason: 'error' };
  }
}

export async function disablePush(): Promise<EnableResult> {
  try {
    const subscription = await getExistingSubscription();
    if (subscription) {
      try {
        await api.delete('/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
      } catch (error) {
        // Continua removendo localmente mesmo se o backend falhar.
      }
      await subscription.unsubscribe();
    }
    await clearPushContext();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'error' };
  }
}
