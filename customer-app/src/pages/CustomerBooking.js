import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { MyAppointments } from '../components/MyAppointments';
import Pagamento from '../components/Pagamento';
import { api } from '../services/api';
const today = format(new Date(), 'yyyy-MM-dd');
function CustomerBooking() {
    const [activeTab, setActiveTab] = useState('booking');
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
    const myAppointmentsRef = useRef(null);
    useEffect(() => {
        async function fetchHaircuts() {
            try {
                const response = await api.get('/haircuts');
                setHaircuts(response.data);
                if (response.data.length > 0) {
                    setSelectedHaircut(response.data[0].id);
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
            if (activeTab !== 'booking') {
                return;
            }
            setLoadingAvailability(true);
            setFeedback(null);
            setSelectedSlot(undefined);
            try {
                const slots = await api.get('/appointments/availability', {
                    params: { date: selectedDate },
                });
                setAvailability(slots.data);
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
    }, [selectedDate, activeTab]);
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
    const handleToggleAppointments = () => {
        const normalizedPhone = customerPhone.replace(/\D/g, '');
        handleClosePayment();
        if (normalizedPhone.length >= 8) {
            try {
                localStorage.setItem('customerPhone', normalizedPhone);
            }
            catch {
                // ignore
            }
        }
        if (activeTab === 'booking') {
            setActiveTab('my-appointments');
            setTimeout(() => {
                myAppointmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        }
        else {
            setActiveTab('booking');
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 80);
        }
    };
    const handlePaymentSuccess = async ({ appointmentId, status }) => {
        try {
            const message = status === 'approved'
                ? 'Pagamento aprovado e agendamento confirmado!'
                : 'Agendamento registrado. Pagamento pendente na barbearia.';
            try {
                const normalizedPhone = customerPhone.replace(/\D/g, '');
                if (normalizedPhone.length >= 8) {
                    localStorage.setItem('customerPhone', normalizedPhone);
                }
            }
            catch {
            }
            setFeedback({
                type: 'success',
                message,
            });
            setCustomerName('');
            setCustomerPhone('');
            setNotes('');
            setSelectedSlot(undefined);
            handleClosePayment();
            setActiveTab('my-appointments');
            setTimeout(() => {
                myAppointmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
            const updated = await api.get('/appointments/availability', {
                params: { date: selectedDate },
            });
            setAvailability(updated.data);
        }
        catch (error) {
            console.error(error);
        }
    };
    return (_jsxs("div", { className: "content-grid", children: [_jsxs("section", { children: [_jsx("h1", { className: "page-title", children: "Agende seu corte" }), _jsx("p", { className: "page-subtitle", children: "Escolha o estilo, a data e o hor\u00E1rio que preferir. Preencha seus dados para garantir o atendimento." }), _jsxs("div", { style: {
                            marginTop: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                        }, children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleToggleAppointments, children: activeTab === 'booking' ? 'Consultar agendamentos pelo telefone' : 'Voltar para agendar' }), activeTab === 'booking' && (_jsx("span", { style: { color: 'var(--color-text-muted)', fontSize: '0.95rem' }, children: "Consulte, cancele ou remarque um horario ja marcado." }))] })] }), _jsxs("section", { className: "card card--dark", ref: myAppointmentsRef, children: [feedback && (_jsx("div", { className: `status-banner ${feedback.type}`, style: { marginBottom: '1rem' }, children: feedback.message })), activeTab === 'booking' ? (_jsxs(_Fragment, { children: [_jsxs("form", { className: "form-grid", onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Tipo de corte", _jsx("select", { value: selectedHaircut, onChange: (event) => setSelectedHaircut(event.target.value), children: haircuts.map((haircut) => (_jsx("option", { value: haircut.id, children: haircut.name }, haircut.id))) }), selectedHaircutDetail && (_jsxs("small", { className: "form-helper", children: [selectedHaircutDetail.description, " \u00B7 ", selectedHaircutDetail.durationMinutes, " minutos"] }))] }), _jsx("div", { className: "flex-between", children: _jsxs("label", { style: { flex: 1 }, children: ["Data do atendimento", _jsx("div", { className: "date-field", onClick: handleDateAreaClick, children: _jsx("input", { ref: dateInputRef, type: "date", min: today, value: selectedDate, onChange: (event) => setSelectedDate(event.target.value) }) })] }) })] }), _jsxs("div", { children: [_jsx("div", { className: "section-title", children: "Hor\u00E1rios dispon\u00EDveis" }), loadingAvailability ? (_jsx("div", { className: "status-banner", children: "Carregando hor\u00E1rios..." })) : (_jsx(_Fragment, { children: _jsx(AvailabilityGrid, { slots: availability, selectedSlot: selectedSlot, onSelect: setSelectedSlot }) }))] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { children: ["Nome completo", _jsx("input", { value: customerName, onChange: (event) => setCustomerName(event.target.value) })] }), _jsxs("label", { children: ["Telefone com DDD", _jsx("input", { value: customerPhone, onChange: (event) => setCustomerPhone(event.target.value) })] }), _jsxs("label", { children: ["Observa\u00E7\u00F5es (opcional)", _jsx("textarea", { value: notes, onChange: (event) => setNotes(event.target.value) })] })] }), _jsx("div", { children: _jsx("button", { type: "submit", className: "btn btn-primary", disabled: !canSubmit, children: submitting ? 'Enviando...' : 'Confirmar agendamento' }) })] }), showPayment && appointmentDraft && selectedHaircutDetail && (_jsx("div", { style: { marginTop: '1.5rem' }, children: _jsx(Pagamento, { appointment: appointmentDraft, haircut: selectedHaircutDetail, onClose: handleClosePayment, onSuccess: handlePaymentSuccess }) }))] })) : (_jsx(MyAppointments, { haircuts: haircuts, initialPhone: customerPhone, autoFocusPhone: true }))] })] }));
}
export default CustomerBooking;
