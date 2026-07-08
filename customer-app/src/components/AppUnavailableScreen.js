import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import logoUrl from '../assets/Logo.jpg';
import './AppUnavailableScreen.css';
export function AppUnavailableScreen() {
    return (_jsx("main", { className: "app-unavailable", "aria-labelledby": "app-unavailable-title", children: _jsxs("section", { className: "app-unavailable__content", children: [_jsx("img", { className: "app-unavailable__logo", src: logoUrl, alt: "Logo da barbearia" }), _jsx("div", { className: "app-unavailable__icon", "aria-hidden": "true", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", role: "img", children: [_jsx("path", { d: "M14.7 6.3a4.2 4.2 0 0 0-5.05 5.05l-4.9 4.9a2.12 2.12 0 0 0 3 3l4.9-4.9A4.2 4.2 0 0 0 17.7 9.3l-2.85 2.85-3-3L14.7 6.3Z", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "m6.35 17.65.01.01", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round" })] }) }), _jsx("h1", { className: "app-unavailable__title", id: "app-unavailable-title", children: "Aplicativo indispon\u00EDvel" }), _jsx("p", { className: "app-unavailable__thanks", children: "Agradecemos a compreens\u00E3o." })] }) }));
}
