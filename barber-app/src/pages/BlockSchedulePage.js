import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { api } from '../services/api';
import { blockedSlotsApi } from '../services/blockedSlots';
const today = format(new Date(), 'yyyy-MM-dd');
function BlockSchedulePage({ selectedDate, onChangeDate, onBack }) {
    const [availability, setAvailability] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState();
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [blockReason, setBlockReason] = useState('');
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [multiSelect, setMultiSelect] = useState(false);
    const dateInputRef = useRef(null);
    const isProgrammaticPickerOpen = useRef(false);
    useEffect(() => {
        async function fetchAvailabilityData() {
            setLoadingAvailability(true);
            setFeedback(null);
            setSelectedSlot(undefined);
            setSelectedSlots([]);
            try {
                const [slots, blocks] = await Promise.all([
                    api.get('/appointments/availability', {
                        params: { date: selectedDate },
                    }),
                    api.get('/blocked-slots', {
                        params: selectedDate ? { date: selectedDate } : undefined,
                    }),
                ]);
                setAvailability(slots.data);
                setBlockedSlots(blocks.data);
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
    const hasSelection = multiSelect ? selectedSlots.length > 0 : Boolean(selectedSlot);
    const refreshDailyData = async () => {
        const [slots, blocks] = await Promise.all([
            api.get('/appointments/availability', {
                params: { date: selectedDate },
            }),
            api.get('/blocked-slots', {
                params: selectedDate ? { date: selectedDate } : undefined,
            }),
        ]);
        setAvailability(slots.data);
        setBlockedSlots(blocks.data);
    };
    const handleBlockSlot = async () => {
        const times = multiSelect ? selectedSlots : selectedSlot ? [selectedSlot] : [];
        if (times.length === 0)
            return;
        setFeedback(null);
        try {
            if (multiSelect) {
                const timeList = times.map((t) => format(parseISO(t), 'HH:mm'));
                await blockedSlotsApi.blockBulk(selectedDate, timeList, blockReason.trim() || undefined);
                setFeedback({ type: 'success', message: 'Horários bloqueados com sucesso.' });
            }
            else {
                await api.post('/blocked-slots', {
                    startTime: times[0],
                    reason: blockReason.trim() || undefined,
                });
                setFeedback({
                    type: 'success',
                    message: 'Horário bloqueado com sucesso.',
                });
            }
            setBlockReason('');
            setSelectedSlot(undefined);
            setSelectedSlots([]);
            await refreshDailyData();
        }
        catch (error) {
            console.error(error);
            const message = error?.response?.data?.message ??
                (error instanceof Error ? error.message : 'Não foi possível bloquear o horário.');
            setFeedback({ type: 'error', message });
        }
    };
    const handleRemoveBlockedSlot = async (id) => {
        setFeedback(null);
        try {
            await api.delete(`/blocked-slots/${id}`);
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
    const handleBulkUnblock = async () => {
        const times = selectedSlots.filter(Boolean);
        if (times.length === 0)
            return;
        setFeedback(null);
        try {
            const timeList = times.map((t) => format(parseISO(t), 'HH:mm'));
            await blockedSlotsApi.unblockBulk(selectedDate, timeList);
            setFeedback({ type: 'success', message: 'Bloqueios removidos.' });
            setSelectedSlots([]);
            await refreshDailyData();
        }
        catch (error) {
            console.error(error);
            const message = error?.response?.data?.message ??
                (error instanceof Error ? error.message : 'Não foi possível remover os bloqueios.');
            setFeedback({ type: 'error', message });
        }
    };
    const toggleSelection = (slotIso) => {
        setSelectedSlots((prev) => {
            const exists = prev.includes(slotIso);
            if (exists) {
                return prev.filter((item) => item !== slotIso);
            }
            return [...prev, slotIso];
        });
    };
    const clearSelection = () => {
        setSelectedSlot(undefined);
        setSelectedSlots([]);
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
    return (_jsxs("div", { className: "content-grid", children: [_jsx("section", { children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: onBack, children: "Voltar" }) }), _jsxs("section", { children: [_jsx("h1", { className: "page-title", children: "Bloquear hor\u00E1rios" }), _jsx("p", { className: "page-subtitle", children: "Selecione os hor\u00E1rios que ficar\u00E3o indispon\u00EDveis para agendamento." }), _jsx("div", { style: { marginTop: '0.75rem' }, children: _jsxs("label", { className: "toggle-chip", children: [_jsx("input", { type: "checkbox", checked: multiSelect, onChange: (event) => {
                                        setMultiSelect(event.target.checked);
                                        clearSelection();
                                    } }), _jsx("span", { className: "toggle-pill", "aria-hidden": true }), _jsx("span", { className: "toggle-label", children: "Selecionar m\u00FAltiplos hor\u00E1rios" })] }) })] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "section-title", children: "Data e hor\u00E1rios" }), _jsx("div", { className: "form-grid", style: { marginBottom: '1.5rem' }, children: _jsxs("label", { style: { minWidth: 0 }, children: ["Escolha a data", _jsx("div", { className: "date-field", style: { minWidth: 0 }, onClick: handleDateFieldClick, children: _jsx("input", { ref: dateInputRef, type: "date", min: today, value: selectedDate, onChange: (event) => onChangeDate(event.target.value) }) })] }) }), loadingAvailability ? (_jsx("div", { className: "status-banner", children: "Carregando hor\u00E1rios para o dia selecionado..." })) : (_jsxs(_Fragment, { children: [_jsx(AvailabilityGrid, { slots: availability, selectedSlot: selectedSlot, selectedSlots: selectedSlots, multiSelect: multiSelect, onSelect: setSelectedSlot, onToggleSelect: toggleSelection }), _jsx("div", { className: "status-banner", style: { marginTop: '1.5rem' }, children: hasAvailableSlots
                                    ? 'Selecione um horário livre e utilize o botão abaixo para bloqueá-lo, caso necessário.'
                                    : 'Todos os horários deste dia estão reservados ou bloqueados.' }), multiSelect ? (_jsxs("div", { className: "card", style: { marginTop: '1rem' }, children: [_jsx("div", { className: "section-title", children: "A\u00E7\u00F5es em lote" }), _jsx("div", { className: "form-grid", style: { marginTop: '0.75rem' }, children: _jsxs("label", { children: ["Motivo do bloqueio (opcional)", _jsx("input", { value: blockReason, onChange: (event) => setBlockReason(event.target.value) })] }) }), _jsxs("div", { className: "inline-actions", style: { marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }, children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleBlockSlot, disabled: !hasSelection, children: "Bloquear selecionados" }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleBulkUnblock, disabled: !hasSelection, children: "Desbloquear selecionados" }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: clearSelection, disabled: !hasSelection, children: "Limpar sele\u00E7\u00E3o" })] })] })) : (_jsxs("div", { className: "form-grid", style: { marginTop: '1.5rem' }, children: [_jsxs("label", { children: ["Motivo do bloqueio (opcional)", _jsx("input", { value: blockReason, onChange: (event) => setBlockReason(event.target.value) })] }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleBlockSlot, disabled: !selectedSlot, children: "Bloquear hor\u00E1rio" })] }))] }))] }), _jsxs("section", { className: "card", children: [_jsx("div", { className: "section-title", children: "Bloqueios do dia selecionado" }), blockedSlots.length === 0 ? (_jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: "Nenhum hor\u00E1rio bloqueado para esta data." })) : (_jsx("div", { className: "table-responsive", children: _jsxs("table", { className: "table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Hor\u00E1rio" }), _jsx("th", { children: "Motivo" }), _jsx("th", { children: "A\u00E7\u00F5es" })] }) }), _jsx("tbody", { children: blockedSlots.map((slot) => {
                                        const slotDate = parseISO(slot.startTime);
                                        return (_jsxs("tr", { children: [_jsx("td", { "data-label": "Hor\u00E1rio", children: format(slotDate, 'HH:mm') }), _jsx("td", { "data-label": "Motivo", children: slot.reason ?? 'Sem motivo cadastrado' }), _jsx("td", { "data-label": "A\u00E7\u00F5es", children: _jsx("div", { className: "inline-actions", children: _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => handleRemoveBlockedSlot(slot.id), children: "Desbloquear" }) }) })] }, slot.id));
                                    }) })] }) }))] }), feedback && _jsx("div", { className: `status-banner ${feedback.type}`, children: feedback.message })] }));
}
export default BlockSchedulePage;
