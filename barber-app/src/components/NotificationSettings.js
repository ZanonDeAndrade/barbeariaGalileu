import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { detectSupport, disablePush, enablePush, ensurePushContext, getPermission, isEnabled, } from '../services/push';
function messageForFailure(reason) {
    switch (reason) {
        case 'permission-denied':
            return 'Você bloqueou as notificações neste navegador. Altere a permissão nas configurações para ativá-las.';
        case 'unsupported':
            return 'Este dispositivo não oferece suporte a notificações.';
        case 'ios-needs-install':
            return 'Adicione o painel à Tela de Início do seu iPhone ou iPad para ativar as notificações.';
        case 'not-configured':
            return 'As notificações ainda não estão disponíveis. Tente novamente mais tarde.';
        case 'barber-key-missing':
            return 'A chave do painel do barbeiro não está configurada neste deploy. Configure VITE_BARBER_API_KEY e publique novamente.';
        case 'barber-auth-failed':
            return 'A chave do painel do barbeiro está incorreta neste deploy. Confira VITE_BARBER_API_KEY e BARBER_API_KEY.';
        default:
            return 'Não foi possível ativar as notificações. Tente novamente.';
    }
}
export function NotificationSettings() {
    const [status, setStatus] = useState('loading');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState(null);
    useEffect(() => {
        let active = true;
        (async () => {
            const support = detectSupport();
            if (support.supported !== true) {
                if (active)
                    setStatus(support.reason);
                return;
            }
            if (getPermission() === 'denied') {
                if (active)
                    setStatus('denied');
                return;
            }
            const enabled = await isEnabled();
            if (active)
                setStatus(enabled ? 'enabled' : 'disabled');
            if (enabled) {
                void ensurePushContext();
            }
        })();
        return () => {
            active = false;
        };
    }, []);
    const handleEnable = async () => {
        setBusy(true);
        setFeedback(null);
        const result = await enablePush();
        if (result.ok) {
            setStatus('enabled');
            setFeedback({ type: 'success', message: 'Notificações ativadas com sucesso.' });
        }
        else {
            if (result.reason === 'permission-denied')
                setStatus('denied');
            if (result.reason === 'unsupported')
                setStatus('unsupported');
            if (result.reason === 'ios-needs-install')
                setStatus('ios-needs-install');
            setFeedback({ type: 'error', message: messageForFailure(result.reason) });
        }
        setBusy(false);
    };
    const handleDisable = async () => {
        setBusy(true);
        setFeedback(null);
        const result = await disablePush();
        if (result.ok) {
            setStatus('disabled');
            setFeedback({ type: 'success', message: 'Notificações desativadas.' });
        }
        else {
            setFeedback({ type: 'error', message: 'Não foi possível desativar as notificações.' });
        }
        setBusy(false);
    };
    if (status === 'loading') {
        return null;
    }
    return (_jsxs("section", { className: "card card--dark", children: [_jsx("div", { className: "section-title", children: "Notifica\u00E7\u00F5es" }), status === 'unsupported' && (_jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Este dispositivo n\u00E3o oferece suporte a notifica\u00E7\u00F5es." })), status === 'ios-needs-install' && (_jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Para receber avisos no iPhone ou iPad, adicione este painel \u00E0 Tela de In\u00EDcio e abra por l\u00E1 antes de ativar as notifica\u00E7\u00F5es." })), status === 'denied' && (_jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Voc\u00EA bloqueou as notifica\u00E7\u00F5es neste navegador. Altere a permiss\u00E3o nas configura\u00E7\u00F5es do navegador para ativ\u00E1-las." })), status === 'disabled' && (_jsxs(_Fragment, { children: [_jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Receba avisos de novos agendamentos, cancelamentos, altera\u00E7\u00F5es e lembretes dos pr\u00F3ximos atendimentos." }), _jsx("div", { className: "inline-actions", style: { marginTop: '1rem' }, children: _jsx("button", { type: "button", className: "btn btn-primary", onClick: handleEnable, disabled: busy, children: busy ? 'Ativando...' : 'Ativar notificações' }) })] })), status === 'enabled' && (_jsxs(_Fragment, { children: [_jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Notifica\u00E7\u00F5es ativadas neste dispositivo." }), _jsx("div", { className: "inline-actions", style: { marginTop: '1rem' }, children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleDisable, disabled: busy, children: busy ? 'Desativando...' : 'Desativar notificações' }) })] })), feedback && (_jsx("div", { className: `status-banner ${feedback.type}`, style: { marginTop: '1rem' }, children: feedback.message }))] }));
}
