import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { api } from '../services/api';
import type { Appointment, HaircutOption } from '../types';

type BarberDashboardProps = {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onNavigateToBlocks: () => void;
  onNavigateToMonthlyMetrics: () => void;
};

const today = format(new Date(), 'yyyy-MM-dd');

function BarberDashboard({
  selectedDate,
  onChangeDate,
  onNavigateToBlocks,
  onNavigateToMonthlyMetrics,
}: BarberDashboardProps) {
  const [haircuts, setHaircuts] = useState<HaircutOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const isProgrammaticPickerOpen = useRef(false);
  const isMountedRef = useRef(true);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchHaircuts = async () => {
    try {
      const haircutList = await api.get<HaircutOption[]>('/haircuts');
      if (!isMountedRef.current) return;
      setHaircuts(haircutList.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAppointments = async (options: { silent?: boolean } = {}) => {
    const silent = options.silent ?? false;
    if (!silent) {
      setLoadingAppointments(true);
      setFeedback(null);
    }

    try {
      const appointmentList = await api.get<Appointment[]>('/appointments');
      if (!isMountedRef.current) return;
      setAppointments(appointmentList.data);
    } catch (error) {
      console.error(error);
      if (!silent && isMountedRef.current) {
        setFeedback({
          type: 'error',
          message: 'Falha ao carregar os agendamentos.',
        });
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setLoadingAppointments(false);
      }
    }
  };

  useEffect(() => {
    fetchHaircuts();
    fetchAppointments();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchAppointments({ silent: true });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  const haircutMap = useMemo(
    () => Object.fromEntries(haircuts.map((item) => [item.id, item.name])),
    [haircuts],
  );

  const dailyAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => format(parseISO(appointment.startTime), 'yyyy-MM-dd') === selectedDate,
      ),
    [appointments, selectedDate],
  );

  const readableSelectedDate = useMemo(() => {
    try {
      return selectedDate
        ? format(parseISO(`${selectedDate}T00:00:00`), 'dd/MM/yyyy')
        : '--/--/----';
    } catch (error) {
      console.error('Erro ao formatar data selecionada', error);
      return '--/--/----';
    }
  }, [selectedDate]);

  const statusLabel = (status: Appointment['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return 'Confirmado';
      case 'CANCELLED':
        return 'Cancelado';
      case 'SCHEDULED':
      default:
        return 'Agendado';
    }
  };

  const openCancelModal = (appointment: Appointment) => {
    setCancelTarget(appointment);
    setCancelReason('');
    setCancelError(null);
    setCancelSubmitting(false);
  };

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setCancelTarget(null);
    setCancelReason('');
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelSubmitting(true);
    setCancelError(null);

    try {
      const reason = cancelReason.trim();
      await api.patch(`/appointments/${cancelTarget.id}/cancel`, reason ? { reason } : {});
      await fetchAppointments();
      closeCancelModal();
    } catch (error) {
      console.error(error);
      setCancelError('NÇœo foi possÇ­vel cancelar o agendamento.');
    } finally {
      setCancelSubmitting(false);
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
        <h1 className="page-title">Área do barbeiro</h1>
        <p className="page-subtitle">
          Acompanhe os agendamentos confirmados e mantenha o dia organizado.
        </p>
      </section>

      <section className="card card--dark">
        <div className="flex-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="section-title">Controle diário</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Defina a data para visualizar os horários confirmados.
            </p>
          </div>
          <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={onNavigateToMonthlyMetrics}>
              Métricas Mensais
            </button>
            <button type="button" className="btn btn-secondary" onClick={onNavigateToBlocks}>
              Bloquear horários
            </button>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
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
      </section>

      <section className="card card--dark">
        <div className="flex-between" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <div className="section-title">Agendamentos do dia</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Lista dos atendimentos confirmados para {readableSelectedDate}.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchAppointments()}
            disabled={loadingAppointments}
          >
            Atualizar
          </button>
        </div>

        {loadingAppointments ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>
            Carregando agendamentos...
          </div>
        ) : dailyAppointments.length === 0 ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>
            Nenhum agendamento encontrado para esta data.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Serviço</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dailyAppointments.map((appointment) => {
                  const dateObj = parseISO(appointment.startTime);
                  return (
                    <tr key={appointment.id}>
                      <td data-label="Data">{format(dateObj, 'dd/MM/yyyy')}</td>
                      <td data-label="Horário">{format(dateObj, 'HH:mm')}</td>
                      <td data-label="Cliente">{appointment.customerName}</td>
                      <td data-label="Telefone">{appointment.customerPhone}</td>
                      <td data-label="Serviço">
                        {haircutMap[appointment.haircutType] ?? appointment.haircutType}
                      </td>
                      <td data-label="Pagamento">
                        {appointment.paymentMethod
                          ? `${appointment.paymentMethod}${
                              appointment.paymentStatus ? ` (${appointment.paymentStatus})` : ''
                            }`
                          : '—'}
                      </td>
                      <td data-label="Status">
                        {statusLabel(appointment.status)}
                        {appointment.status === 'CANCELLED' && appointment.cancelReason ? (
                          <div style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            Motivo: {appointment.cancelReason}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Ações">
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openCancelModal(appointment)}
                            disabled={appointment.status === 'CANCELLED'}
                          >
                            {appointment.status === 'CANCELLED' ? 'Cancelado' : 'Cancelar'}
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

      {cancelTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="card modal-card">
            <div className="section-title">Cancelar agendamento</div>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              {cancelTarget.customerName} em {format(parseISO(cancelTarget.startTime), 'dd/MM/yyyy')} Às{' '}
              {format(parseISO(cancelTarget.startTime), 'HH:mm')}.
            </p>

            <div className="form-grid" style={{ marginTop: '1rem' }}>
              <label>
                Motivo (opcional)
                <input
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Ex: cliente pediu para remarcar"
                  disabled={cancelSubmitting}
                />
              </label>
            </div>

            {cancelError && (
              <div className="status-banner error" style={{ marginTop: '1rem' }}>
                {cancelError}
              </div>
            )}

            <div className="inline-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeCancelModal}
                disabled={cancelSubmitting}
              >
                Voltar
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmCancel} disabled={cancelSubmitting}>
                {cancelSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarberDashboard;
