const resolveDefaultApiBaseUrl = () => {
    if (typeof window === 'undefined') {
        return 'http://localhost:4000/api';
    }
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000/api`;
};
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? resolveDefaultApiBaseUrl();
async function req(path, init) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(init || {}),
    });
    if (!res.ok)
        throw new Error(`Erro ${res.status}`);
    if (res.status === 204)
        return undefined;
    return (await res.json());
}
export const paymentsApi = {
    processCard: (params) => req('/process-payment', { body: JSON.stringify(params) }),
    createPix: (params) => req('/payment/pix', { body: JSON.stringify(params) }),
    cash: (appointment) => req('/payment/cash', { body: JSON.stringify(appointment) }),
};
