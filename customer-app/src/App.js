import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import CustomerBooking from './pages/CustomerBooking';
function App() {
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "app-header", children: _jsx("div", { className: "brand", children: "Barbearia Galileu" }) }), _jsxs("main", { className: "app-main", children: [_jsx(AddToHomescreenPrompt, {}), _jsx(CustomerBooking, {})] }), _jsxs("footer", { className: "app-footer", children: ["\u00A9 ", new Date().getFullYear(), " Barbearia Galileu. Todos os direitos reservados."] })] }));
}
export default App;
