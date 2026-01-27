import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvailabilityGrid } from './AvailabilityGrid';
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
        case 'COMPLETED':
            return 'Atendido';
        case 'SCHEDULED':
        default:
            return 'Agendado';
    }
}
export function MyAppointments({ haircuts, initialPhone, autoFocusPhone }) {
    const phoneInputRef = useRef(null);
    const [phone, setPhone] = useState(() => {
        const fromProps = initialPhone?.trim();
        if (fromProps)
            return fromProps;
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
    const [feedback, setFeedback] = useState(null);
    const [searched, setSearched] = useState(false);
    const [action, setAction] = useState(null);
    const [actionReason, setActionReason] = useState('');
    const [actionError, setActionError] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);
    const [availability, setAvailability] = useState([]);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [rescheduleSlot, setRescheduleSlot] = useState();
    const didAutoSearch = useRef(false);
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const haircutMap = useMemo(() => Object.fromEntries(haircuts.map((item) => [item.id, item.name])), [haircuts]);
    const canSearch = useMemo(() => normalizePhone(phone).length >= 8 && !loading, [phone, loading]);
    const fetchAppointments = async () => {
        const phoneToSearch = phone.trim();
        setLoading(true);
        setError(null);
        setFeedback(null);
        try {
            const response = await api.post('/appointments/by-phone', { phone: phoneToSearch, limit: 5 });
            setAppointments(response.data.appointments ?? []);
            setSearched(true);
            try {
                localStorage.setItem('customerPhone', normalizePhone(phoneToSearch));
            }
            catch {
                // ignore
            }
        }
        catch (err) {
            console.error(err);
            setError('Nao foi possivel buscar seus agendamentos. Verifique o telefone e tente novamente.');
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
    useEffect(() => {
        if (!initialPhone)
            return;
        const normalized = normalizePhone(initialPhone);
        if (normalized.length >= 8) {
            setPhone(initialPhone.trim());
        }
    }, [initialPhone]);
    useEffect(() => {
        if (!autoFocusPhone)
            return;
        phoneInputRef.current?.focus();
    }, [autoFocusPhone]);
    useEffect(() => {
        if (action?.type !== 'reschedule')
            return;
        setAvailabilityLoading(true);
        setActionError(null);
        api
            .get('/appointments/availability', { params: { date: rescheduleDate } })
            .then((response) => {
            setAvailability(response.data ?? []);
        })
            .catch((err) => {
            console.error(err);
            setAvailability([]);
            setActionError('Nao foi possivel carregar os horarios para esta data.');
        })
            .finally(() => {
            setAvailabilityLoading(false);
        });
    }, [action?.type, rescheduleDate]);
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!canSearch)
            return;
        void fetchAppointments();
    };
    const resolveApiError = (err, fallback) => {
        const code = err?.response?.data?.code ?? err?.response?.data?.details?.code;
        if (code === 'HORARIO_INDISPONIVEL')
            return 'Horario indisponivel. Escolha outro horario.';
        if (code === 'PAYMENT_ALREADY_PAID')
            return 'Pagamento ja aprovado. Fale com a barbearia.';
        if (code === 'OWNERSHIP_MISMATCH')
            return 'Agendamento nao encontrado para este telefone.';
        if (code === 'PAST_APPOINTMENT' || code === 'INVALID_STATUS') {
            return 'Este agendamento nao pode mais ser alterado.';
        }
        return fallback;
    };
    const openCancel = (appointment) => {
        setAction({ type: 'cancel', appointment });
        setActionReason('');
        setActionError(null);
    };
    const openReschedule = (appointment) => {
        const defaultDate = format(parseISO(appointment.startTime), 'yyyy-MM-dd');
        setRescheduleDate(defaultDate);
        setRescheduleSlot(undefined);
        setAvailability([]);
        setAction({ type: 'reschedule', appointment });
        setActionReason('');
        setActionError(null);
    };
    const closeAction = () => {
        setAction(null);
        setActionReason('');
        setActionError(null);
        setRescheduleSlot(undefined);
        setAvailability([]);
    };
    const submitCancel = async () => {
        if (!action)
            return;
        const phoneToSubmit = phone.trim();
        setLoadingAction(true);
        setActionError(null);
        try {
            await api.patch(`/appointments/${action.appointment.id}/cancel-by-customer`, {
                phone: phoneToSubmit,
                reason: actionReason.trim() || undefined,
            });
            setFeedback('Agendamento cancelado com sucesso.');
            closeAction();
            await fetchAppointments();
        }
        catch (err) {
            console.error(err);
            setActionError(resolveApiError(err, 'Nao foi possivel cancelar o agendamento.'));
        }
        finally {
            setLoadingAction(false);
        }
    };
    const submitReschedule = async () => {
        if (!action)
            return;
        if (!rescheduleSlot) {
            setActionError('Escolha um novo horario.');
            return;
        }
        const phoneToSubmit = phone.trim();
        setLoadingAction(true);
        setActionError(null);
        try {
            await api.post(`/appointments/${action.appointment.id}/reschedule`, {
                phone: phoneToSubmit,
                newStartTime: rescheduleSlot,
                reason: actionReason.trim() || undefined,
            });
            setFeedback('Agendamento remarcado com sucesso!');
            closeAction();
            await fetchAppointments();
        }
        catch (err) {
            console.error(err);
            setActionError(resolveApiError(err, 'Nao foi possivel remarcar. Tente outro horario.'));
        }
        finally {
            setLoadingAction(false);
        }
    };
    return (_jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Meus agendamentos" }), _jsx("p", { style: { color: 'var(--color-text-muted)', marginTop: '0.5rem' }, children: "Informe seu telefone para ver os seus 5 ultimos agendamentos." }), _jsxs("form", { className: "form-grid", style: { marginTop: '1rem' }, onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Telefone com DDD", _jsx("input", { ref: phoneInputRef, value: phone, onChange: (event) => setPhone(event.target.value), placeholder: "(11) 99999-9999", inputMode: "tel", autoComplete: "tel" })] }), _jsxs("div", { className: "inline-actions", children: [_jsx("button", { type: "submit", className: "btn btn-primary", disabled: !canSearch, children: loading ? 'Buscando...' : 'Buscar' }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => {
                                    setAppointments([]);
                                    setSearched(false);
                                    setError(null);
                                    setFeedback(null);
                                }, disabled: loading, children: "Limpar" })] })] }), feedback && (_jsx("div", { className: "status-banner success", style: { marginTop: '1rem' }, children: feedback })), error && (_jsx("div", { className: "status-banner error", style: { marginTop: '1rem' }, children: error })), !error && searched && appointments.length === 0 && (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Nenhum agendamento encontrado para este telefone." })), appointments.length > 0 && (_jsx("div", { className: "table-responsive", style: { marginTop: '1rem' }, children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Data" }), _jsx("th", { children: "Horario" }), _jsx("th", { children: "Servico" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Acoes" })] }) }), _jsx("tbody", { children: appointments.slice(0, 5).map((appointment) => {
                                const date = parseISO(appointment.startTime);
                                const isActiveAction = action?.appointment.id === appointment.id && loadingAction;
                                return (_jsxs("tr", { children: [_jsx("td", { "data-label": "Data", children: format(date, 'dd/MM/yyyy') }), _jsx("td", { "data-label": "Horario", children: format(date, 'HH:mm') }), _jsx("td", { "data-label": "Servico", children: haircutMap[appointment.haircutType] ?? appointment.haircutType }), _jsx("td", { "data-label": "Status", children: statusLabel(appointment.status) }), _jsx("td", { "data-label": "Acoes", children: appointment.canCancel || appointment.canReschedule ? (_jsxs("div", { className: "inline-actions", style: { gap: '0.5rem' }, children: [appointment.canCancel && (_jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => openCancel(appointment), disabled: loadingAction, children: "Cancelar" })), appointment.canReschedule && (_jsx("button", { type: "button", className: "btn btn-primary", onClick: () => openReschedule(appointment), disabled: loadingAction, children: "Remarcar" })), isActiveAction && _jsx("small", { children: "Processando..." })] })) : (_jsx("span", { style: { color: 'var(--color-text-muted)' }, children: "-" })) })] }, appointment.id));
                            }) })] }) })), action && (_jsxs("div", { className: "card", style: { marginTop: '1.25rem' }, children: [_jsx("div", { className: "section-title", children: action.type === 'cancel' ? 'Cancelar agendamento' : 'Remarcar agendamento' }), _jsxs("p", { style: { color: 'var(--color-text-muted)', marginBottom: '0.75rem' }, children: [format(parseISO(action.appointment.startTime), 'dd/MM/yyyy'), " as", ' ', format(parseISO(action.appointment.startTime), 'HH:mm'), " -", ' ', haircutMap[action.appointment.haircutType] ?? action.appointment.haircutType] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Motivo (opcional)", _jsx("textarea", { value: actionReason, onChange: (event) => setActionReason(event.target.value), placeholder: "Ex.: Nao vou conseguir comparecer" })] }), action.type === 'reschedule' && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["Nova data", _jsx("input", { type: "date", min: todayIso, value: rescheduleDate, onChange: (event) => {
                                                    setRescheduleDate(event.target.value);
                                                    setRescheduleSlot(undefined);
                                                } })] }), _jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Escolha um horario" }), availabilityLoading ? (_jsx("div", { className: "status-banner", style: { marginTop: '0.5rem' }, children: "Carregando horarios..." })) : (_jsx("div", { style: { marginTop: '0.5rem' }, children: _jsx(AvailabilityGrid, { slots: availability, selectedSlot: rescheduleSlot, onSelect: setRescheduleSlot }) }))] })] }))] }), actionError && (_jsx("div", { className: "status-banner error", style: { marginTop: '0.5rem' }, children: actionError })), _jsxs("div", { className: "inline-actions", style: { marginTop: '0.75rem' }, children: [_jsx("button", { type: "button", className: "btn btn-primary", onClick: action.type === 'cancel' ? submitCancel : submitReschedule, disabled: loadingAction || (action.type === 'reschedule' && !rescheduleSlot), children: loadingAction
                                    ? 'Enviando...'
                                    : action.type === 'cancel'
                                        ? 'Confirmar cancelamento'
                                        : 'Confirmar remarcacao' }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: closeAction, disabled: loadingAction, children: "Fechar" })] })] }))] }));
}
