import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
function normalizePhone(value) {
    return value.replace(/\D/g, '');
}
function statusLabel(status) {
    switch (status) {
        case 'CONFIRMED':
            return 'Confirmado';
        case 'CANCELLED':
            return 'Cancelado';
        case 'SCHEDULED':
        default:
            return 'Agendado';
    }
}
export function MyAppointments({ haircuts }) {
    const [phone, setPhone] = useState(() => {
        try {
            return localStorage.getItem('customerPhone') ?? '';
        }
        catch {
            return '';
        }
    });
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searched, setSearched] = useState(false);
    const didAutoSearch = useRef(false);
    const haircutMap = useMemo(() => Object.fromEntries(haircuts.map((item) => [item.id, item.name])), [haircuts]);
    const canSearch = useMemo(() => normalizePhone(phone).length >= 8 && !loading, [phone, loading]);
    const fetchAppointments = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/appointments/by-phone', { phone, limit: 5 });
            setAppointments(response.data.appointments ?? []);
            setSearched(true);
            try {
                localStorage.setItem('customerPhone', normalizePhone(phone));
            }
            catch {
                // ignore
            }
        }
        catch (err) {
            console.error(err);
            setError('Não foi possível buscar seus agendamentos. Verifique o telefone e tente novamente.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (didAutoSearch.current)
            return;
        if (normalizePhone(phone).length < 8)
            return;
        didAutoSearch.current = true;
        void fetchAppointments();
    }, []);
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSearch)
            return;
        void fetchAppointments();
    };
    return (_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Meus agendamentos" }), _jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Informe seu telefone para ver os seus 5 \u00FAltimos agendamentos." }), _jsxs("form", { className: "form-grid", style: { marginTop: '1rem' }, onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Telefone com DDD", _jsx("input", { value: phone, onChange: (event) => setPhone(event.target.value), placeholder: "(11) 99999-9999", inputMode: "tel", autoComplete: "tel" })] }), _jsxs("div", { className: "inline-actions", children: [_jsx("button", { type: "submit", className: "btn btn-primary", disabled: !canSearch, children: loading ? 'Buscando...' : 'Buscar' }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => {
                                    setAppointments([]);
                                    setSearched(false);
                                    setError(null);
                                }, disabled: loading, children: "Limpar" })] })] }), error && (_jsx("div", { className: "status-banner error", style: { marginTop: '1rem' }, children: error })), !error && searched && appointments.length === 0 && (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Nenhum agendamento encontrado para este telefone." })), appointments.length > 0 && (_jsx("div", { className: "table-responsive", style: { marginTop: '1rem' }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Data" }), _jsx("th", { children: "Hor\u00E1rio" }), _jsx("th", { children: "Servi\u00E7o" }), _jsx("th", { children: "Status" })] }) }), _jsx("tbody", { children: appointments.slice(0, 5).map((appointment) => {
                                const date = parseISO(appointment.startTime);
                                return (_jsxs("tr", { children: [_jsx("td", { "data-label": "Data", children: format(date, 'dd/MM/yyyy') }), _jsx("td", { "data-label": "Hor\u00E1rio", children: format(date, 'HH:mm') }), _jsx("td", { "data-label": "Servi\u00E7o", children: haircutMap[appointment.haircutType] ?? appointment.haircutType }), _jsx("td", { "data-label": "Status", children: statusLabel(appointment.status) })] }, appointment.id));
                            }) })] }) }))] }));
}
