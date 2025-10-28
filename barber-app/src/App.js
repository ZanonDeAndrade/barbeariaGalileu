import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format } from 'date-fns';
import { useState } from 'react';
import { AddToHomescreenPrompt } from './components/AddToHomescreenPrompt';
import BarberDashboard from './pages/BarberDashboard';
import BlockSchedulePage from './pages/BlockSchedulePage';
const today = format(new Date(), 'yyyy-MM-dd');
function App() {
    const [activePage, setActivePage] = useState('dashboard');
    const [selectedDate, setSelectedDate] = useState(today);
    const handleNavigateToBlocks = () => setActivePage('block');
    const handleNavigateToDashboard = () => setActivePage('dashboard');
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { className: "app-header", children: [_jsx("div", { className: "brand", children: "Barbearia Galileu" }), _jsx("div", { className: "page-subtitle", style: { marginBottom: 0 }, children: "Painel interno do barbeiro" })] }), _jsxs("main", { className: "app-main", children: [_jsx(AddToHomescreenPrompt, {}), activePage === 'dashboard' ? (_jsx(BarberDashboard, { selectedDate: selectedDate, onChangeDate: setSelectedDate, onNavigateToBlocks: handleNavigateToBlocks })) : (_jsx(BlockSchedulePage, { selectedDate: selectedDate, onChangeDate: setSelectedDate, onBack: handleNavigateToDashboard }))] }), _jsxs("footer", { className: "app-footer", children: ["\u00A9 ", new Date().getFullYear(), " Barbearia Galileu. Uso restrito ao time interno."] })] }));
}
export default App;
