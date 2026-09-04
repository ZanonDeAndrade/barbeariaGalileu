import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import CustomerBooking from './pages/CustomerBooking';
function App() {
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "app-header", children: _jsx("div", { className: "brand", children: "Barbearia De David" }) }), _jsxs("main", { className: "app-main", children: [_jsx(AddToHomescreenPrompt, {}), _jsx(CustomerBooking, {})] }), _jsxs("footer", { className: "app-footer", children: [_jsxs("div", { children: ["\u00A9 ", new Date().getFullYear(), " Barbearia De David. Todos os direitos reservados."] }), _jsx("a", { className: "app-footer-credit", href: "https://www.instagram.com/arthurzanon.dev/", target: "_blank", rel: "noopener noreferrer", children: "Desenvolvido por Zanon de Andrade Softwares - CNPJ: 57.971.378/0001-50" })] })] }));
}
export default App;
