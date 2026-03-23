export function keepBackendAlive() {
    const isEnabled = import.meta.env.VITE_ENABLE_KEEP_BACKEND_ALIVE === 'true';
    const apiBaseUrl = import.meta.env.VITE_API_URL;
    if (!isEnabled || !apiBaseUrl) {
        return;
    }
    const URL = `${apiBaseUrl.replace(/\/$/, '')}/health`;
    async function ping() {
        try {
            await fetch(URL, {
                method: 'GET',
                cache: 'no-store',
            });
        }
        catch {
            console.warn('Keep alive ping failed');
        }
    }
    ping();
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            ping();
        }
    }, 4 * 60 * 1000);
}
