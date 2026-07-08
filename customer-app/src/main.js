import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { keepBackendAlive } from './utils/keepBackendAlive';
import './styles/global.css';
keepBackendAlive();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
}
if ('serviceWorker' in navigator) {
    // Fallback do clique em notificacao: quando o SW nao consegue navegar a
    // janela diretamente, ele envia PUSH_NAVIGATE com a URL de destino.
    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (data?.type === 'PUSH_NAVIGATE' && typeof data.url === 'string') {
            window.location.assign(data.url);
        }
    });
}
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
