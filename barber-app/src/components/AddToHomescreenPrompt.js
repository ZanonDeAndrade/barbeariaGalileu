import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
function detectPlatform(userAgent) {
    const normalized = userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(normalized)) {
        return 'ios';
    }
    if (/android/.test(normalized)) {
        return 'android';
    }
    return 'other';
}
const STEP_ICONS = {
    share: (_jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, focusable: "false", children: [_jsx("path", { d: "M12 3.25a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06L11.25 11.2V4a.75.75 0 0 1 .75-.75Z", fill: "currentColor" }), _jsx("path", { d: "M6.75 13a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-1.5 0v3.75H7.5V13.75A.75.75 0 0 0 6.75 13Z", fill: "currentColor" })] })),
    menu: (_jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, focusable: "false", children: _jsx("path", { d: "M5.25 7.5h13.5a.75.75 0 0 0 0-1.5H5.25a.75.75 0 0 0 0 1.5Zm0 5h13.5a.75.75 0 0 0 0-1.5H5.25a.75.75 0 0 0 0 1.5Zm0 5h13.5a.75.75 0 0 0 0-1.5H5.25a.75.75 0 0 0 0 1.5Z", fill: "currentColor" }) })),
    home: (_jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, focusable: "false", children: _jsx("path", { d: "M11.47 3.22a.75.75 0 0 1 1.06 0l7.25 7.25a.75.75 0 1 1-1.06 1.06l-.22-.22V19a2 2 0 0 1-2 2h-3.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-2a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 1-.75.75H7.5a2 2 0 0 1-2-2v-7.69l-.22.22a.75.75 0 1 1-1.06-1.06l7.25-7.25Z", fill: "currentColor" }) })),
};
export function AddToHomescreenPrompt() {
    const [visible, setVisible] = useState(false);
    const [platform, setPlatform] = useState('other');
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches ||
            // @ts-expect-error - standalone está disponível apenas no Safari iOS
            window.navigator.standalone === true;
        if (isStandalone) {
            return;
        }
        const detected = detectPlatform(window.navigator.userAgent);
        if (detected === 'ios' || detected === 'android') {
            setPlatform(detected);
            setVisible(true);
        }
    }, []);
    const handleDismiss = () => {
        setVisible(false);
    };
    const instructions = useMemo(() => {
        if (platform === 'ios') {
            return {
                title: 'Adicione à tela inicial',
                subtitle: 'Salve este painel na tela inicial do seu iPhone ou iPad para acessar em instantes.',
                steps: [
                    { icon: 'share', description: 'Toque no botão Compartilhar na barra inferior.' },
                    { icon: 'home', description: 'Escolha “Adicionar à Tela de Início” e confirme.' },
                ],
            };
        }
        if (platform === 'android') {
            return {
                title: 'Instale o atalho',
                subtitle: 'Fique de olho nos agendamentos com um toque a partir da tela inicial do Android.',
                steps: [
                    { icon: 'menu', description: 'Abra o menu do navegador (⋮).' },
                    { icon: 'home', description: 'Selecione “Adicionar à tela inicial” e toque em Adicionar.' },
                ],
            };
        }
        return null;
    }, [platform]);
    if (!visible || !instructions) {
        return null;
    }
    return (_jsxs("div", { className: "a2hs-banner", role: "alert", children: [_jsxs("div", { className: "a2hs-header", children: [_jsx("div", { className: "a2hs-brand", children: _jsxs("div", { className: "a2hs-brand-copy", children: [_jsx("span", { className: "a2hs-brand-name", children: "Barbearia De David" }), _jsx("span", { className: "a2hs-brand-tagline", children: "Painel do barbeiro" })] }) }), _jsx("button", { type: "button", className: "a2hs-dismiss", onClick: handleDismiss, "aria-label": "Fechar aviso", children: "\u00D7" })] }), _jsxs("div", { className: "a2hs-content", children: [_jsx("strong", { children: instructions.title }), _jsx("p", { children: instructions.subtitle }), _jsx("ul", { className: "a2hs-steps", children: instructions.steps.map((step, index) => (_jsxs("li", { children: [_jsx("span", { className: "a2hs-step-icon", children: STEP_ICONS[step.icon] }), _jsx("span", { className: "a2hs-step-text", children: step.description })] }, index))) })] }), _jsx("button", { type: "button", className: "a2hs-close", onClick: handleDismiss, children: "Ok, vou fazer depois" })] }));
}
