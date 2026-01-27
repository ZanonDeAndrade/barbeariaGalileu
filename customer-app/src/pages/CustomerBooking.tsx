import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { MyAppointments } from '../components/MyAppointments';
import Pagamento from '../components/Pagamento';
import { api } from '../services/api';
import type {
  CreateAppointmentPayload,
  HaircutOption,
  SlotAvailability,
} from '../types';

const today = format(new Date(), 'yyyy-MM-dd');

function CustomerBooking() {
  const [activeTab, setActiveTab] = useState<'booking' | 'my-appointments'>('booking');
  const [haircuts, setHaircuts] = useState<HaircutOption[]>([]);
  const [selectedHaircut, setSelectedHaircut] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [appointmentDraft, setAppointmentDraft] = useState<CreateAppointmentPayload | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const isProgrammaticPickerOpen = useRef(false);
  const myAppointmentsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function fetchHaircuts() {
      try {
        const response = await api.get<HaircutOption[]>('/haircuts');
        setHaircuts(response.data);
        if (response.data.length > 0) {
          setSelectedHaircut(response.data[0].id);
        }
      } catch (error) {
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
        const slots = await api.get<SlotAvailability[]>('/appointments/availability', {
          params: { date: selectedDate },
        });
        setAvailability(slots.data);
      } catch (error) {
        console.error(error);
        setAvailability([]);
        setFeedback({
          type: 'error',
          message: 'Não foi possível carregar os horários. Tente novamente mais tarde.',
        });
      } finally {
        setLoadingAvailability(false);
      }
    }

    fetchAvailability();
  }, [selectedDate, activeTab]);

  const selectedHaircutDetail = useMemo(
    () => haircuts.find((item) => item.id === selectedHaircut),
    [haircuts, selectedHaircut],
  );

  const canSubmit = Boolean(
    selectedHaircut &&
      selectedSlot &&
      customerName.trim().length >= 3 &&
      customerPhone.trim().length >= 8 &&
      !submitting,
  );

  const openNativeDatePicker = () => {
    const input = dateInputRef.current;
    if (isProgrammaticPickerOpen.current) {
      return;
    }

    if (!input) {
      return;
    }

    input.focus({ preventScroll: true });
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
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

  const handleDateAreaClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (isProgrammaticPickerOpen.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openNativeDatePicker();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlot || !selectedHaircut) {
      return;
    }

    const payload: CreateAppointmentPayload = {
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
      } catch {
        // ignore
      }
    }

    if (activeTab === 'booking') {
      setActiveTab('my-appointments');
      setTimeout(() => {
        myAppointmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } else {
      setActiveTab('booking');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 80);
    }
  };

  const handlePaymentSuccess = async ({ appointmentId, status }: { appointmentId?: string; status: string }) => {
    try {
      const message =
        status === 'approved'
          ? 'Pagamento aprovado e agendamento confirmado!'
          : 'Agendamento registrado. Pagamento pendente na barbearia.';

      try {
        const normalizedPhone = customerPhone.replace(/\D/g, '');
        if (normalizedPhone.length >= 8) {
          localStorage.setItem('customerPhone', normalizedPhone);
        }
      } catch {
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

      const updated = await api.get<SlotAvailability[]>('/appointments/availability', {
        params: { date: selectedDate },
      });
      setAvailability(updated.data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="content-grid">
      <section>
        <h1 className="page-title">Agende seu corte</h1>
        <p className="page-subtitle">
          Escolha o estilo, a data e o horário que preferir. Preencha seus dados para garantir o atendimento.
        </p>

        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={handleToggleAppointments}>
            {activeTab === 'booking' ? 'Consultar agendamentos pelo telefone' : 'Voltar para agendar'}
          </button>
          {activeTab === 'booking' && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
              Consulte, cancele ou remarque um horario ja marcado.
            </span>
          )}
        </div>
      </section>

      <section className="card card--dark" ref={myAppointmentsRef}>
        {feedback && (
          <div className={`status-banner ${feedback.type}`} style={{ marginBottom: '1rem' }}>
            {feedback.message}
          </div>
        )}

        {activeTab === 'booking' ? (
          <>
            <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Tipo de corte
              <select value={selectedHaircut} onChange={(event) => setSelectedHaircut(event.target.value)}>
                {haircuts.map((haircut) => (
                  <option key={haircut.id} value={haircut.id}>
                    {haircut.name}
                  </option>
                ))}
              </select>
              {selectedHaircutDetail && (
                <small className="form-helper">
                  {selectedHaircutDetail.description} · {selectedHaircutDetail.durationMinutes} minutos
                </small>
              )}
            </label>

            <div className="flex-between">
              <label style={{ flex: 1 }}>
                Data do atendimento
                <div className="date-field" onClick={handleDateAreaClick}>
                  <input
                    ref={dateInputRef}
                    type="date"
                    min={today}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                </div>
              </label>
            </div>
          </div>

          <div>
            <div className="section-title">Horários disponíveis</div>
            {loadingAvailability ? (
              <div className="status-banner">Carregando horários...</div>
            ) : (
              <>
                <AvailabilityGrid slots={availability} selectedSlot={selectedSlot} onSelect={setSelectedSlot} />
              </>
            )}
          </div>

          <div className="form-grid">
            <label>
              Nome completo
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              Telefone com DDD
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
            <label>
              Observações (opcional)
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Enviando...' : 'Confirmar agendamento'}
            </button>
          </div>
        </form>

        {showPayment && appointmentDraft && selectedHaircutDetail && (
          <div style={{ marginTop: '1.5rem' }}>
            <Pagamento
              appointment={appointmentDraft}
              haircut={selectedHaircutDetail}
              onClose={handleClosePayment}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}
          </>
        ) : (
          <MyAppointments haircuts={haircuts} initialPhone={customerPhone} autoFocusPhone />
        )}
      </section>
    </div>
  );
}

export default CustomerBooking;
