import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { api, ApiError } from '../services/api';
import type {
  CreateAppointmentPayload,
  HaircutOption,
  SlotAvailability,
} from '../types';

const today = format(new Date(), 'yyyy-MM-dd');

function CustomerBooking() {
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
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const isProgrammaticPickerOpen = useRef(false);

  useEffect(() => {
    async function fetchHaircuts() {
      try {
        const data = await api.getHaircuts();
        setHaircuts(data);
        if (data.length > 0) {
          setSelectedHaircut(data[0].id);
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
      setLoadingAvailability(true);
      setFeedback(null);
      setSelectedSlot(undefined);
      try {
        const slots = await api.getAvailability(selectedDate);
        setAvailability(slots);
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
  }, [selectedDate]);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

    try {
      await api.createAppointment(payload);
      setFeedback({
        type: 'success',
        message: 'Agendamento confirmado! Você receberá o atendimento no horário escolhido.',
      });
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');
      setSelectedSlot(undefined);
      const updated = await api.getAvailability(selectedDate);
      setAvailability(updated);
    } catch (error) {
      console.error(error);
      if (error instanceof ApiError) {
        setFeedback({
          type: 'error',
          message: error.message,
        });
      } else {
        setFeedback({
          type: 'error',
          message: 'Não foi possível concluir o agendamento. Tente novamente.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content-grid">
      <section>
        <h1 className="page-title">Agende seu corte</h1>
        <p className="page-subtitle">
          Escolha o estilo, a data e o horário que preferir. Preencha seus dados para garantir o atendimento.
        </p>
      </section>

      <section className="card">
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
                <AvailabilityGrid
                  slots={availability}
                  selectedSlot={selectedSlot}
                  onSelect={setSelectedSlot}
                />
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

          {feedback && (
            <div className={`status-banner ${feedback.type}`}>{feedback.message}</div>
          )}

          <div>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Enviando...' : 'Confirmar agendamento'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default CustomerBooking;
