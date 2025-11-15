import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import Pagamento from '../components/Pagamento';
import { api } from '../services/api';
const today = format(new Date(), 'yyyy-MM-dd');
function CustomerBooking() {
    const [haircuts, setHaircuts] = useState([]);
    const [selectedHaircut, setSelectedHaircut] = useState('');
    const [selectedDate, setSelectedDate] = useState(today);
    const [availability, setAvailability] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState();
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [notes, setNotes] = useState('');
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [showPayment, setShowPayment] = useState(false);
    const [appointmentDraft, setAppointmentDraft] = useState(null);
    const dateInputRef = useRef(null);
    const isProgrammaticPickerOpen = useRef(false);
    useEffect(() => {
        async function fetchHaircuts() {
            try {
                const data = await api.getHaircuts();
                setHaircuts(data);
                if (data.length > 0) {
                    setSelectedHaircut(data[0].id);
                }
            }
            catch (error) {
                console.error(error);
                setFeedback({
                    type: 'error',
                    message: 'Não foi possível carregar os tipos de corte.',
                });
            }
        }
        fetchHaircuts();
    }, []);
    useEffect(() => {
        async function fetchAvailability() {
            setLoadingAvailability(true);
            setFeedback(null);
            setSelectedSlot(undefined);
            try {
                const slots = await api.getAvailability(selectedDate);
                setAvailability(slots);
            }
            catch (error) {
                console.error(error);
                setAvailability([]);
                setFeedback({
                    type: 'error',
                    message: 'Não foi possível carregar os horários. Tente novamente mais tarde.',
                });
            }
            finally {
                setLoadingAvailability(false);
            }
        }
        fetchAvailability();
    }, [selectedDate]);
    const selectedHaircutDetail = useMemo(() => haircuts.find((item) => item.id === selectedHaircut), [haircuts, selectedHaircut]);
    const canSubmit = Boolean(selectedHaircut &&
        selectedSlot &&
        customerName.trim().length >= 3 &&
        customerPhone.trim().length >= 8 &&
        !submitting);
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
    const handleDateAreaClick = (event) => {
        if (isProgrammaticPickerOpen.current) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        openNativeDatePicker();
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!selectedSlot || !selectedHaircut) {
            return;
        }
        const payload = {
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            haircutType: selectedHaircut,
            startTime: selectedSlot,
            notes: notes.trim() || undefined,
        };
        setSubmitting(true);
        setFeedback(null);
        setAppointmentDraft(payload);
        setShowPayment(true);
    };
    const handleClosePayment = () => {
        setShowPayment(false);
        setAppointmentDraft(null);
        setSubmitting(false);
    };
    const handlePaymentSuccess = async ({ appointmentId, status }) => {
        try {
            const message = status === 'approved'
                ? 'Pagamento aprovado e agendamento confirmado!'
                : 'Agendamento registrado. Pagamento pendente na barbearia.';
            setFeedback({
                type: 'success',
                message,
            });
            setCustomerName('');
            setCustomerPhone('');
            setNotes('');
            setSelectedSlot(undefined);
            handleClosePayment();
            const updated = await api.getAvailability(selectedDate);
            setAvailability(updated);
        }
        catch (error) {
            console.error(error);
        }
    };
    return (_jsxs("div", { className: "content-grid", children: [_jsxs("section", { children: [_jsx("h1", { className: "page-title", children: "Agende seu corte" }), _jsx("p", { className: "page-subtitle", children: "Escolha o estilo, a data e o hor\u00E1rio que preferir. Preencha seus dados para garantir o atendimento." })] }), _jsxs("section", { className: "card card--dark", children: [_jsxs("form", { className: "form-grid", onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Tipo de corte", _jsx("select", { value: selectedHaircut, onChange: (event) => setSelectedHaircut(event.target.value), children: haircuts.map((haircut) => (_jsx("option", { value: haircut.id, children: haircut.name }, haircut.id))) }), selectedHaircutDetail && (_jsxs("small", { className: "form-helper", children: [selectedHaircutDetail.description, " \u00B7 ", selectedHaircutDetail.durationMinutes, " minutos"] }))] }), _jsx("div", { className: "flex-between", children: _jsxs("label", { style: { flex: 1 }, children: ["Data do atendimento", _jsx("div", { className: "date-field", onClick: handleDateAreaClick, children: _jsx("input", { ref: dateInputRef, type: "date", min: today, value: selectedDate, onChange: (event) => setSelectedDate(event.target.value) }) })] }) })] }), _jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Hor\u00E1rios dispon\u00EDveis" }), loadingAvailability ? (_jsx("div", { className: "status-banner", children: "Carregando hor\u00E1rios..." })) : (_jsx(_Fragment, { children: _jsx(AvailabilityGrid, { slots: availability, selectedSlot: selectedSlot, onSelect: setSelectedSlot }) }))] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Nome completo", _jsx("input", { value: customerName, onChange: (event) => setCustomerName(event.target.value) })] }), _jsxs("label", { children: ["Telefone com DDD", _jsx("input", { value: customerPhone, onChange: (event) => setCustomerPhone(event.target.value) })] }), _jsxs("label", { children: ["Observa\u00E7\u00F5es (opcional)", _jsx("textarea", { value: notes, onChange: (event) => setNotes(event.target.value) })] })] }), feedback && _jsx("div", { className: `status-banner ${feedback.type}`, children: feedback.message }), _jsx("div", { children: _jsx("button", { type: "submit", className: "btn btn-primary", disabled: !canSubmit, children: submitting ? 'Enviando...' : 'Confirmar agendamento' }) })] }), showPayment && appointmentDraft && selectedHaircutDetail && (_jsx("div", { style: { marginTop: '1.5rem' }, children: _jsx(Pagamento, { appointment: appointmentDraft, haircut: selectedHaircutDetail, onClose: handleClosePayment, onSuccess: handlePaymentSuccess }) }))] })] }));
}
export default CustomerBooking;
