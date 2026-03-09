export function keepBackendAlive() {
    const URL = 'https://barbeariagalileu.onrender.com/health';
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
