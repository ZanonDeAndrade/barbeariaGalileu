import { api, apiBaseURL } from './api';
const PUSH_CONTEXT_CACHE = 'push-config';
const PUSH_CONTEXT_KEY = '/__push_context__';
function normalizePhone(value) {
    return value.replace(/\D/g, '');
}
export function isIos() {
    if (typeof navigator === 'undefined')
        return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
    if (typeof window === 'undefined')
        return false;
    return (window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true);
}
export function detectSupport() {
    const hasApis = typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        typeof window !== 'undefined' &&
        'PushManager' in window &&
        'Notification' in window;
    if (!hasApis) {
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
export function getPermission() {
    if (typeof Notification === 'undefined')
        return 'unsupported';
    return Notification.permission;
}
function urlBase64ToUint8Array(base64String) {
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
async function fetchPublicKey() {
    try {
        const response = await api.get('/push/public-key');
        return response.data.publicKey ?? null;
    }
    catch (error) {
        return null;
    }
}
async function getRegistration() {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
        await navigator.serviceWorker.ready;
        return existing;
    }
    await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
}
export async function getExistingSubscription() {
    if (detectSupport().supported !== true)
        return null;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration)
            return null;
        return await registration.pushManager.getSubscription();
    }
    catch (error) {
        return null;
    }
}
export async function isEnabled() {
    const subscription = await getExistingSubscription();
    return Boolean(subscription);
}
async function storePushContext(vapidPublicKey, phone) {
    try {
        const cache = await caches.open(PUSH_CONTEXT_CACHE);
        const context = {
            vapidPublicKey,
            subscribeUrl: `${apiBaseURL}/push/subscribe`,
            headers: {},
            extra: { phone },
        };
        await cache.put(PUSH_CONTEXT_KEY, new Response(JSON.stringify(context), {
            headers: { 'Content-Type': 'application/json' },
        }));
    }
    catch (error) {
        // Contexto e opcional (usado apenas para re-inscricao automatica).
    }
}
async function clearPushContext() {
    try {
        const cache = await caches.open(PUSH_CONTEXT_CACHE);
        await cache.delete(PUSH_CONTEXT_KEY);
    }
    catch (error) {
        // ignore
    }
}
/**
 * Regrava o contexto de re-inscricao caso ele tenha sido perdido
 * (ex.: usuario ativou as notificacoes antes de uma atualizacao do SW).
 */
export async function ensurePushContext() {
    try {
        if (!(await isEnabled()))
            return;
        let phone = '';
        try {
            phone = normalizePhone(localStorage.getItem('customerPhone') ?? '');
        }
        catch {
            return;
        }
        if (phone.length < 8)
            return;
        const cache = await caches.open(PUSH_CONTEXT_CACHE);
        const existing = await cache.match(PUSH_CONTEXT_KEY);
        if (existing)
            return;
        const publicKey = await fetchPublicKey();
        if (!publicKey)
            return;
        await storePushContext(publicKey, phone);
    }
    catch (error) {
        // Contexto e opcional; falha aqui nao afeta o funcionamento atual.
    }
}
export async function enablePush(rawPhone) {
    const phone = normalizePhone(rawPhone ?? '');
    if (phone.length < 8) {
        return { ok: false, reason: 'missing-phone' };
    }
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
    try {
        const registration = await getRegistration();
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
        }
        await api.post('/push/subscribe', {
            phone,
            subscription: subscription.toJSON(),
            userAgent: navigator.userAgent,
        });
        await storePushContext(publicKey, phone);
        return { ok: true };
    }
    catch (error) {
        return { ok: false, reason: 'error' };
    }
}
export async function disablePush() {
    try {
        const subscription = await getExistingSubscription();
        if (subscription) {
            try {
                await api.delete('/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
            }
            catch (error) {
                // Continua removendo localmente mesmo se o backend falhar.
            }
            await subscription.unsubscribe();
        }
        await clearPushContext();
        return { ok: true };
    }
    catch (error) {
        return { ok: false, reason: 'error' };
    }
}
