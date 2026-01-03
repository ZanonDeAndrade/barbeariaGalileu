import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
const today = format(new Date(), 'yyyy-MM-dd');
function BarberDashboard({ selectedDate, onChangeDate, onNavigateToBlocks }) {
    const [haircuts, setHaircuts] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const dateInputRef = useRef(null);
    const isProgrammaticPickerOpen = useRef(false);
    const isMountedRef = useRef(true);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelSubmitting, setCancelSubmitting] = useState(false);
    const [cancelError, setCancelError] = useState(null);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const fetchHaircuts = async () => {
        try {
            const haircutList = await api.get('/haircuts');
            if (!isMountedRef.current)
                return;
            setHaircuts(haircutList.data);
        }
        catch (error) {
            console.error(error);
        }
    };
    const fetchAppointments = async (options = {}) => {
        const silent = options.silent ?? false;
        if (!silent) {
            setLoadingAppointments(true);
            setFeedback(null);
        }
        try {
            const appointmentList = await api.get('/appointments');
            if (!isMountedRef.current)
                return;
            setAppointments(appointmentList.data);
        }
        catch (error) {
            console.error(error);
            if (!silent && isMountedRef.current) {
                setFeedback({
                    type: 'error',
                    message: 'Falha ao carregar os agendamentos.',
                });
            }
        }
        finally {
            if (!silent && isMountedRef.current) {
                setLoadingAppointments(false);
            }
        }
    };
    useEffect(() => {
        fetchHaircuts();
        fetchAppointments();
    }, []);
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            fetchAppointments({ silent: true });
        }, 15000);
        return () => window.clearInterval(intervalId);
    }, []);
    const haircutMap = useMemo(() => Object.fromEntries(haircuts.map((item) => [item.id, item.name])), [haircuts]);
    const dailyAppointments = useMemo(() => appointments.filter((appointment) => format(parseISO(appointment.startTime), 'yyyy-MM-dd') === selectedDate), [appointments, selectedDate]);
    const readableSelectedDate = useMemo(() => {
        try {
            return selectedDate
                ? format(parseISO(`${selectedDate}T00:00:00`), 'dd/MM/yyyy')
                : '--/--/----';
        }
        catch (error) {
            console.error('Erro ao formatar data selecionada', error);
            return '--/--/----';
        }
    }, [selectedDate]);
    const statusLabel = (status) => {
        switch (status) {
            case 'CONFIRMED':
                return 'Confirmado';
            case 'CANCELLED':
                return 'Cancelado';
            case 'SCHEDULED':
            default:
                return 'Agendado';
        }
    };
    const openCancelModal = (appointment) => {
        setCancelTarget(appointment);
        setCancelReason('');
        setCancelError(null);
        setCancelSubmitting(false);
    };
    const closeCancelModal = () => {
        if (cancelSubmitting)
            return;
        setCancelTarget(null);
        setCancelReason('');
        setCancelError(null);
    };
    const confirmCancel = async () => {
        if (!cancelTarget)
            return;
        setCancelSubmitting(true);
        setCancelError(null);
        try {
            const reason = cancelReason.trim();
            await api.patch(`/appointments/${cancelTarget.id}/cancel`, reason ? { reason } : {});
            await fetchAppointments();
            closeCancelModal();
        }
        catch (error) {
            console.error(error);
            setCancelError('NÇœo foi possÇ­vel cancelar o agendamento.');
        }
        finally {
            setCancelSubmitting(false);
        }
    };
    const openNativeDatePicker = () => {
        const input = dateInputRef.current;
        if (isProgrammaticPickerOpen.current) {
            return;
        }
        if (!input) {
            return;
        }
        input.focus({ preventScroll: true });
        const pickerInput = input;
        if (typeof pickerInput.showPicker === 'function') {
            pickerInput.showPicker();
            return;
        }
        isProgrammaticPickerOpen.current = true;
        pickerInput.click();
        setTimeout(() => {
            isProgrammaticPickerOpen.current = false;
        }, 0);
    };
    const handleDateFieldClick = (event) => {
        if (isProgrammaticPickerOpen.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        openNativeDatePicker();
    };
    return (_jsxs("div", { className: "content-grid", children: [_jsxs("section", { children: [_jsx("h1", { className: "page-title", children: "\u00C1rea do barbeiro" }), _jsx("p", { className: "page-subtitle", children: "Acompanhe os agendamentos confirmados e mantenha o dia organizado." })] }), _jsxs("section", { className: "card card--dark", children: [_jsxs("div", { className: "flex-between", style: { alignItems: 'flex-start' }, children: [_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Controle di\u00E1rio" }), _jsx("p", { style: { color: 'var(--color-text-muted)', fontSize: '0.9rem' }, children: "Defina a data para visualizar os hor\u00E1rios confirmados." })] }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: onNavigateToBlocks, children: "Bloquear hor\u00E1rios" })] }), _jsx("div", { className: "form-grid", style: { marginTop: '1.5rem' }, children: _jsxs("label", { children: ["Escolha a data", _jsx("div", { className: "date-field", onClick: handleDateFieldClick, children: _jsx("input", { ref: dateInputRef, type: "date", min: today, value: selectedDate, onChange: (event) => onChangeDate(event.target.value) }) })] }) })] }), _jsxs("section", { className: "card card--dark", children: [_jsxs("div", { className: "flex-between", style: { alignItems: 'flex-start', gap: '0.75rem' }, children: [_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Agendamentos do dia" }), _jsxs("p", { style: { color: 'var(--color-text-muted)', fontSize: '0.9rem' }, children: ["Lista dos atendimentos confirmados para ", readableSelectedDate, "."] })] }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => fetchAppointments(), disabled: loadingAppointments, children: "Atualizar" })] }), loadingAppointments ? (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Carregando agendamentos..." })) : dailyAppointments.length === 0 ? (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Nenhum agendamento encontrado para esta data." })) : (_jsx("div", { className: "table-responsive", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Data" }), _jsx("th", { children: "Hor\u00E1rio" }), _jsx("th", { children: "Cliente" }), _jsx("th", { children: "Telefone" }), _jsx("th", { children: "Servi\u00E7o" }), _jsx("th", { children: "Pagamento" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: dailyAppointments.map((appointment) => {
                                        const dateObj = parseISO(appointment.startTime);
                                        return (_jsxs("tr", { children: [_jsx("td", { "data-label": "Data", children: format(dateObj, 'dd/MM/yyyy') }), _jsx("td", { "data-label": "Hor\u00E1rio", children: format(dateObj, 'HH:mm') }), _jsx("td", { "data-label": "Cliente", children: appointment.customerName }), _jsx("td", { "data-label": "Telefone", children: appointment.customerPhone }), _jsx("td", { "data-label": "Servi\u00E7o", children: haircutMap[appointment.haircutType] ?? appointment.haircutType }), _jsx("td", { "data-label": "Pagamento", children: appointment.paymentMethod
                                                        ? `${appointment.paymentMethod}${appointment.paymentStatus ? ` (${appointment.paymentStatus})` : ''}`
                                                        : '—' }), _jsxs("td", { "data-label": "Status", children: [statusLabel(appointment.status), appointment.status === 'CANCELLED' && appointment.cancelReason ? (_jsxs("div", { style: { marginTop: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }, children: ["Motivo: ", appointment.cancelReason] })) : null] }), _jsx("td", { "data-label": "A\u00E7\u00F5es", children: _jsx("div", { className: "inline-actions", children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => openCancelModal(appointment), disabled: appointment.status === 'CANCELLED', children: appointment.status === 'CANCELLED' ? 'Cancelado' : 'Cancelar' }) }) })] }, appointment.id));
                                    }) })] }) }))] }), feedback && _jsx("div", { className: `status-banner ${feedback.type}`, children: feedback.message }), cancelTarget && (_jsx("div", { className: "modal-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "card modal-card", children: [_jsx("div", { className: "section-title", children: "Cancelar agendamento" }), _jsxs("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: [cancelTarget.customerName, " em ", format(parseISO(cancelTarget.startTime), 'dd/MM/yyyy'), " \u00C0s", ' ', format(parseISO(cancelTarget.startTime), 'HH:mm'), "."] }), _jsx("div", { className: "form-grid", style: { marginTop: '1rem' }, children: _jsxs("label", { children: ["Motivo (opcional)", _jsx("input", { value: cancelReason, onChange: (event) => setCancelReason(event.target.value), placeholder: "Ex: cliente pediu para remarcar", disabled: cancelSubmitting })] }) }), cancelError && (_jsx("div", { className: "status-banner error", style: { marginTop: '1rem' }, children: cancelError })), _jsxs("div", { className: "inline-actions", style: { marginTop: '1rem' }, children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: closeCancelModal, disabled: cancelSubmitting, children: "Voltar" }), _jsx("button", { type: "button", className: "btn btn-primary", onClick: confirmCancel, disabled: cancelSubmitting, children: cancelSubmitting ? 'Cancelando...' : 'Confirmar cancelamento' })] })] }) }))] }));
}
export default BarberDashboard;
