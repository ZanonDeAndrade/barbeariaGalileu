import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { api, ApiError } from '../services/api';
import type {
  Appointment,
  BlockedSlot,
  HaircutOption,
  SlotAvailability,
} from '../types';

const today = format(new Date(), 'yyyy-MM-dd');

function BarberDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [haircuts, setHaircuts] = useState<HaircutOption[]>([]);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>();
  const [blockReason, setBlockReason] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
      setLoadingAppointments(true);
      try {
        const [haircutList, appointmentList] = await Promise.all([
          api.getHaircuts(),
          api.listAppointments(),
        ]);
        setHaircuts(haircutList);
        setAppointments(appointmentList);
      } catch (error) {
        console.error(error);
        setFeedback({
          type: 'error',
          message: 'Falha ao carregar agendamentos iniciais.',
        });
      } finally {
        setLoadingAppointments(false);
      }
    }

    fetchInitialData();
  }, []);

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

  const haircutMap = useMemo(
    () => Object.fromEntries(haircuts.map((item) => [item.id, item.name])),
    [haircuts],
  );

  const hasAvailableSlots = availability.some((slot) => slot.status === 'available');

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

  const refreshDailyData = async () => {
    const [slots, blocks, appointmentList] = await Promise.all([
      api.getAvailability(selectedDate),
      api.listBlockedSlots(selectedDate),
      api.listAppointments(),
    ]);
    setAvailability(slots);
    setBlockedSlots(blocks);
    setAppointments(appointmentList);
  };

  return (
    <div className="content-grid">
      <section>
        <h1 className="page-title">Área do barbeiro</h1>
        <p className="page-subtitle">
          Gerencie os horários da agenda, bloqueie períodos indisponíveis e acompanhe os agendamentos confirmados.
        </p>
      </section>

      <section className="card">
        <div className="section-title">Controle diário</div>
        <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
          <label>
            Escolha a data
            <input
              type="date"
              min={today}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
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
            <div className="legend">
              <div className="legend-item">
                <span className="legend-dot available" /> Disponível
              </div>
              <div className="legend-item">
                <span className="legend-dot booked" /> Reservado
              </div>
              <div className="legend-item">
                <span className="legend-dot blocked" /> Bloqueado
              </div>
            </div>
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
        <div className="flex-between">
          <div>
            <div className="section-title">Agendamentos confirmados</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Lista completa dos agendamentos futuros.
            </p>
          </div>
        </div>

        {loadingAppointments ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>Carregando agendamentos...</div>
        ) : appointments.length === 0 ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>Nenhum agendamento futuro encontrado.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Serviço</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => {
                const dateObj = parseISO(appointment.startTime);
                return (
                  <tr key={appointment.id}>
                    <td>{format(dateObj, "dd/MM/yyyy")}</td>
                    <td>{format(dateObj, 'HH:mm')}</td>
                    <td>{appointment.customerName}</td>
                    <td>{appointment.customerPhone}</td>
                    <td>{haircutMap[appointment.haircutType] ?? appointment.haircutType}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="flex-between">
          <div>
            <div className="section-title">Bloqueios do dia selecionado</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Remova um bloqueio caso o horário volte a ficar disponível.
            </p>
          </div>
        </div>

        {blockedSlots.length === 0 ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>
            Nenhum horário bloqueado para esta data.
          </div>
        ) : (
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
                    <td>{format(slotDate, 'HH:mm')}</td>
                    <td>{slot.reason ?? 'Sem motivo cadastrado'}</td>
                    <td>
                      <div className="inline-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => handleRemoveBlockedSlot(slot.id)}>
                          Desbloquear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {feedback && <div className={`status-banner ${feedback.type}`}>{feedback.message}</div>}
    </div>
  );
}

export default BarberDashboard;
