import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { api, ApiError } from '../services/api';
const today = format(new Date(), 'yyyy-MM-dd');
function BlockSchedulePage({ selectedDate, onChangeDate, onBack }) {
    const [availability, setAvailability] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState();
    const [blockReason, setBlockReason] = useState('');
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const dateInputRef = useRef(null);
    const isProgrammaticPickerOpen = useRef(false);
    useEffect(() => {
        async function fetchAvailabilityData() {
            setLoadingAvailability(true);
            setFeedback(null);
            setSelectedSlot(undefined);
            try {
                const [slots, blocks] = await Promise.all([
                    api.getAvailability(selectedDate),
                    api.listBlockedSlots(selectedDate),
                ]);
                setAvailability(slots);
                setBlockedSlots(blocks);
            }
            catch (error) {
                console.error(error);
                setAvailability([]);
                setBlockedSlots([]);
                setFeedback({
                    type: 'error',
                    message: 'Não foi possível carregar os horários para o barbeiro.',
                });
            }
            finally {
                setLoadingAvailability(false);
            }
        }
        fetchAvailabilityData();
    }, [selectedDate]);
    const hasAvailableSlots = availability.some((slot) => slot.status === 'available');
    const refreshDailyData = async () => {
        const [slots, blocks] = await Promise.all([
            api.getAvailability(selectedDate),
            api.listBlockedSlots(selectedDate),
        ]);
        setAvailability(slots);
        setBlockedSlots(blocks);
    };
    const handleBlockSlot = async () => {
        if (!selectedSlot) {
            return;
        }
        setFeedback(null);
        try {
            await api.createBlockedSlot({
                startTime: selectedSlot,
                reason: blockReason.trim() || undefined,
            });
            setFeedback({
                type: 'success',
                message: 'Horário bloqueado com sucesso.',
            });
            setBlockReason('');
            setSelectedSlot(undefined);
            await refreshDailyData();
        }
        catch (error) {
            console.error(error);
            if (error instanceof ApiError) {
                setFeedback({ type: 'error', message: error.message });
            }
            else {
                setFeedback({ type: 'error', message: 'Não foi possível bloquear o horário.' });
            }
        }
    };
    const handleRemoveBlockedSlot = async (id) => {
        setFeedback(null);
        try {
            await api.removeBlockedSlot(id);
            setFeedback({
                type: 'success',
                message: 'Bloqueio removido.',
            });
            await refreshDailyData();
        }
        catch (error) {
            console.error(error);
            setFeedback({
                type: 'error',
                message: 'Não foi possível remover o bloqueio.',
            });
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
    return (_jsxs("div", { className: "content-grid", children: [_jsx("section", { children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: onBack, children: "Voltar" }) }), _jsxs("section", { children: [_jsx("h1", { className: "page-title", children: "Bloquear hor\u00E1rios" }), _jsx("p", { className: "page-subtitle", children: "Selecione os hor\u00E1rios que ficar\u00E3o indispon\u00EDveis para agendamento." })] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "section-title", children: "Data e hor\u00E1rios" }), _jsx("div", { className: "form-grid", style: { marginBottom: '1.5rem' }, children: _jsxs("label", { children: ["Escolha a data", _jsx("div", { className: "date-field", onClick: handleDateFieldClick, children: _jsx("input", { ref: dateInputRef, type: "date", min: today, value: selectedDate, onChange: (event) => onChangeDate(event.target.value) }) })] }) }), loadingAvailability ? (_jsx("div", { className: "status-banner", children: "Carregando hor\u00E1rios para o dia selecionado..." })) : (_jsxs(_Fragment, { children: [_jsx(AvailabilityGrid, { slots: availability, selectedSlot: selectedSlot, onSelect: setSelectedSlot }), _jsx("div", { className: "status-banner", style: { marginTop: '1.5rem' }, children: hasAvailableSlots
                                    ? 'Selecione um horário livre e utilize o botão abaixo para bloqueá-lo, caso necessário.'
                                    : 'Todos os horários deste dia estão reservados ou bloqueados.' }), _jsxs("div", { className: "form-grid", style: { marginTop: '1.5rem' }, children: [_jsxs("label", { children: ["Motivo do bloqueio (opcional)", _jsx("input", { value: blockReason, onChange: (event) => setBlockReason(event.target.value) })] }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleBlockSlot, disabled: !selectedSlot, children: "Bloquear hor\u00E1rio" })] })] }))] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "section-title", children: "Bloqueios do dia selecionado" }), blockedSlots.length === 0 ? (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Nenhum hor\u00E1rio bloqueado para esta data." })) : (_jsx("div", { className: "table-responsive", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Hor\u00E1rio" }), _jsx("th", { children: "Motivo" }), _jsx("th", { children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: blockedSlots.map((slot) => {
                                        const slotDate = parseISO(slot.startTime);
                                        return (_jsxs("tr", { children: [_jsx("td", { "data-label": "Hor\u00E1rio", children: format(slotDate, 'HH:mm') }), _jsx("td", { "data-label": "Motivo", children: slot.reason ?? 'Sem motivo cadastrado' }), _jsx("td", { "data-label": "A\u00E7\u00F5es", children: _jsx("div", { className: "inline-actions", children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => handleRemoveBlockedSlot(slot.id), children: "Desbloquear" }) }) })] }, slot.id));
                                    }) })] }) }))] }), feedback && _jsx("div", { className: `status-banner ${feedback.type}`, children: feedback.message })] }));
}
export default BlockSchedulePage;
