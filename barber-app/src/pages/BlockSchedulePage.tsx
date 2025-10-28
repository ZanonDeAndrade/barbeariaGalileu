import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { api, ApiError } from '../services/api';
import type { BlockedSlot, SlotAvailability } from '../types';

type BlockSchedulePageProps = {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onBack: () => void;
};

const today = format(new Date(), 'yyyy-MM-dd');

function BlockSchedulePage({ selectedDate, onChangeDate, onBack }: BlockSchedulePageProps) {
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>();
  const [blockReason, setBlockReason] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
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
      } catch (error) {
        console.error(error);
        setAvailability([]);
        setBlockedSlots([]);
        setFeedback({
          type: 'error',
          message: 'Não foi possível carregar os horários para o barbeiro.',
        });
      } finally {
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
    } catch (error) {
      console.error(error);
      if (error instanceof ApiError) {
        setFeedback({ type: 'error', message: error.message });
      } else {
        setFeedback({ type: 'error', message: 'Não foi possível bloquear o horário.' });
      }
    }
  };

  const handleRemoveBlockedSlot = async (id: string) => {
    setFeedback(null);
    try {
      await api.removeBlockedSlot(id);
      setFeedback({
        type: 'success',
        message: 'Bloqueio removido.',
      });
      await refreshDailyData();
    } catch (error) {
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

  const handleDateFieldClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (isProgrammaticPickerOpen.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openNativeDatePicker();
  };

  return (
    <div className="content-grid">
      <section>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Voltar
        </button>
      </section>

      <section>
        <h1 className="page-title">Bloquear horários</h1>
        <p className="page-subtitle">
          Selecione os horários que ficarão indisponíveis para agendamento.
        </p>
      </section>

      <section className="card">
        <div className="section-title">Data e horários</div>
        <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
          <label>
            Escolha a data
            <div className="date-field" onClick={handleDateFieldClick}>
              <input
                ref={dateInputRef}
                type="date"
                min={today}
                value={selectedDate}
                onChange={(event) => onChangeDate(event.target.value)}
              />
            </div>
          </label>
        </div>

        {loadingAvailability ? (
          <div className="status-banner">Carregando horários para o dia selecionado...</div>
        ) : (
          <>
            <AvailabilityGrid
              slots={availability}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
            />
            <div className="status-banner" style={{ marginTop: '1.5rem' }}>
              {hasAvailableSlots
                ? 'Selecione um horário livre e utilize o botão abaixo para bloqueá-lo, caso necessário.'
                : 'Todos os horários deste dia estão reservados ou bloqueados.'}
            </div>
            <div className="form-grid" style={{ marginTop: '1.5rem' }}>
              <label>
                Motivo do bloqueio (opcional)
                <input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBlockSlot}
                disabled={!selectedSlot}
              >
                Bloquear horário
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-title">Bloqueios do dia selecionado</div>

        {blockedSlots.length === 0 ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>
            Nenhum horário bloqueado para esta data.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Motivo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {blockedSlots.map((slot) => {
                  const slotDate = parseISO(slot.startTime);
                  return (
                    <tr key={slot.id}>
                      <td data-label="Horário">{format(slotDate, 'HH:mm')}</td>
                      <td data-label="Motivo">{slot.reason ?? 'Sem motivo cadastrado'}</td>
                      <td data-label="Ações">
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRemoveBlockedSlot(slot.id)}
                          >
                            Desbloquear
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {feedback && <div className={`status-banner ${feedback.type}`}>{feedback.message}</div>}
    </div>
  );
}

export default BlockSchedulePage;
