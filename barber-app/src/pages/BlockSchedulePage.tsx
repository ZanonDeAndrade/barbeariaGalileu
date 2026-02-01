import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { api } from '../services/api';
import { blockedSlotsApi } from '../services/blockedSlots';
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
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const isProgrammaticPickerOpen = useRef(false);

  useEffect(() => {
    async function fetchAvailabilityData() {
      setLoadingAvailability(true);
      setFeedback(null);
      setSelectedSlot(undefined);
      setSelectedSlots([]);
      try {
        const [slots, blocks] = await Promise.all([
          api.get<SlotAvailability[]>('/appointments/availability', {
            params: { date: selectedDate },
          }),
          api.get<BlockedSlot[]>('/blocked-slots', {
            params: selectedDate ? { date: selectedDate } : undefined,
          }),
        ]);
        setAvailability(slots.data);
        setBlockedSlots(blocks.data);
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
  const hasSelection = multiSelect ? selectedSlots.length > 0 : Boolean(selectedSlot);

  const refreshDailyData = async () => {
    const [slots, blocks] = await Promise.all([
      api.get<SlotAvailability[]>('/appointments/availability', {
        params: { date: selectedDate },
      }),
      api.get<BlockedSlot[]>('/blocked-slots', {
        params: selectedDate ? { date: selectedDate } : undefined,
      }),
    ]);
    setAvailability(slots.data);
    setBlockedSlots(blocks.data);
  };

  const handleBlockSlot = async () => {
    const times = multiSelect ? selectedSlots : selectedSlot ? [selectedSlot] : [];
    if (times.length === 0) return;

    setFeedback(null);
    try {
      if (multiSelect) {
        const timeList = times.map((t) => format(parseISO(t), 'HH:mm'));
        await blockedSlotsApi.blockBulk(selectedDate, timeList, blockReason.trim() || undefined);
        setFeedback({ type: 'success', message: 'Horários bloqueados com sucesso.' });
      } else {
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
    } catch (error) {
      console.error(error);
      const message =
        (error as any)?.response?.data?.message ??
        (error instanceof Error ? error.message : 'Não foi possível bloquear o horário.');
      setFeedback({ type: 'error', message });
    }
  };

  const handleRemoveBlockedSlot = async (id: string) => {
    setFeedback(null);
    try {
      await api.delete(`/blocked-slots/${id}`);
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

  const handleBulkUnblock = async () => {
    const times = selectedSlots.filter(Boolean);
    if (times.length === 0) return;

    setFeedback(null);
    try {
      const timeList = times.map((t) => format(parseISO(t), 'HH:mm'));
      await blockedSlotsApi.unblockBulk(selectedDate, timeList);
      setFeedback({ type: 'success', message: 'Bloqueios removidos.' });
      setSelectedSlots([]);
      await refreshDailyData();
    } catch (error) {
      console.error(error);
      const message =
        (error as any)?.response?.data?.message ??
        (error instanceof Error ? error.message : 'Não foi possível remover os bloqueios.');
      setFeedback({ type: 'error', message });
    }
  };

  const toggleSelection = (slotIso: string) => {
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
        <div style={{ marginTop: '0.75rem' }}>
          <label className="toggle-chip">
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(event) => {
                setMultiSelect(event.target.checked);
                clearSelection();
              }}
            />
            <span className="toggle-pill" aria-hidden />
            <span className="toggle-label">Selecionar múltiplos horários</span>
          </label>
        </div>
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
              selectedSlots={selectedSlots}
              multiSelect={multiSelect}
              onSelect={setSelectedSlot}
              onToggleSelect={toggleSelection}
            />
            <div className="status-banner" style={{ marginTop: '1.5rem' }}>
              {hasAvailableSlots
                ? 'Selecione um horário livre e utilize o botão abaixo para bloqueá-lo, caso necessário.'
                : 'Todos os horários deste dia estão reservados ou bloqueados.'}
            </div>
            {multiSelect ? (
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="section-title">Ações em lote</div>
                <div className="form-grid" style={{ marginTop: '0.75rem' }}>
                  <label>
                    Motivo do bloqueio (opcional)
                    <input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} />
                  </label>
                </div>
                <div className="inline-actions" style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleBlockSlot}
                    disabled={!hasSelection}
                  >
                    Bloquear selecionados
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleBulkUnblock}
                    disabled={!hasSelection}
                  >
                    Desbloquear selecionados
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={clearSelection} disabled={!hasSelection}>
                    Limpar seleção
                  </button>
                </div>
              </div>
            ) : (
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
            )}
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
