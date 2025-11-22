import axios from 'axios';
const isDev = import.meta.env.DEV;
const baseHost = isDev ? 'http://localhost:4000' : import.meta.env.VITE_API_URL;
const baseURL = (() => {
    if (!baseHost) {
        console.warn('[API] baseURL não definida. Verifique VITE_API_URL em produção.');
        return '';
    }
    const trimmed = baseHost.replace(/\/$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();
export const api = axios.create({
    baseURL,
});
