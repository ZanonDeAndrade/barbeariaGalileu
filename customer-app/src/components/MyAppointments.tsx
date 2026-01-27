import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvailabilityGrid } from './AvailabilityGrid';
import { api } from '../services/api';
import type { CustomerAppointmentSummary, HaircutOption, SlotAvailability } from '../types';

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function statusLabel(status: CustomerAppointmentSummary['status']) {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmado';
    case 'CANCELLED':
      return 'Cancelado';
    case 'COMPLETED':
      return 'Atendido';
    case 'SCHEDULED':
    default:
      return 'Agendado';
  }
}

type MyAppointmentsProps = {
  haircuts: HaircutOption[];
  initialPhone?: string;
  autoFocusPhone?: boolean;
};

type ActionState = {
  type: 'cancel' | 'reschedule';
  appointment: CustomerAppointmentSummary;
};

export function MyAppointments({ haircuts, initialPhone, autoFocusPhone }: MyAppointmentsProps) {
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const [phone, setPhone] = useState(() => {
    const fromProps = initialPhone?.trim();
    if (fromProps) return fromProps;

    try {
      return localStorage.getItem('customerPhone') ?? '';
    } catch {
      return '';
    }
  });
  const [appointments, setAppointments] = useState<CustomerAppointmentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [action, setAction] = useState<ActionState | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rescheduleSlot, setRescheduleSlot] = useState<string | undefined>();
  const didAutoSearch = useRef(false);
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const haircutMap = useMemo(
    () => Object.fromEntries(haircuts.map((item) => [item.id, item.name])),
    [haircuts],
  );

  const canSearch = useMemo(() => normalizePhone(phone).length >= 8 && !loading, [phone, loading]);

  const fetchAppointments = async () => {
    const phoneToSearch = phone.trim();
    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await api.post<{ appointments: CustomerAppointmentSummary[] }>(
        '/appointments/by-phone',
        { phone: phoneToSearch, limit: 5 },
      );
      setAppointments(response.data.appointments ?? []);
      setSearched(true);
      try {
        localStorage.setItem('customerPhone', normalizePhone(phoneToSearch));
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      setError('Nao foi possivel buscar seus agendamentos. Verifique o telefone e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didAutoSearch.current) return;
    if (normalizePhone(phone).length < 8) return;
    didAutoSearch.current = true;
    void fetchAppointments();
  }, []);

  useEffect(() => {
    if (!initialPhone) return;
    const normalized = normalizePhone(initialPhone);
    if (normalized.length >= 8) {
      setPhone(initialPhone.trim());
    }
  }, [initialPhone]);

  useEffect(() => {
    if (!autoFocusPhone) return;
    phoneInputRef.current?.focus();
  }, [autoFocusPhone]);

  useEffect(() => {
    if (action?.type !== 'reschedule') return;
    setAvailabilityLoading(true);
    setActionError(null);
    api
      .get<SlotAvailability[]>('/appointments/availability', { params: { date: rescheduleDate } })
      .then((response) => {
        setAvailability(response.data ?? []);
      })
      .catch((err) => {
        console.error(err);
        setAvailability([]);
        setActionError('Nao foi possivel carregar os horarios para esta data.');
      })
      .finally(() => {
        setAvailabilityLoading(false);
      });
  }, [action?.type, rescheduleDate]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) return;
    void fetchAppointments();
  };

  const resolveApiError = (err: any, fallback: string) => {
    const code = err?.response?.data?.code ?? err?.response?.data?.details?.code;
    if (code === 'HORARIO_INDISPONIVEL') return 'Horario indisponivel. Escolha outro horario.';
    if (code === 'PAYMENT_ALREADY_PAID') return 'Pagamento ja aprovado. Fale com a barbearia.';
    if (code === 'OWNERSHIP_MISMATCH') return 'Agendamento nao encontrado para este telefone.';
    if (code === 'PAST_APPOINTMENT' || code === 'INVALID_STATUS') {
      return 'Este agendamento nao pode mais ser alterado.';
    }
    return fallback;
  };

  const openCancel = (appointment: CustomerAppointmentSummary) => {
    setAction({ type: 'cancel', appointment });
    setActionReason('');
    setActionError(null);
  };

  const openReschedule = (appointment: CustomerAppointmentSummary) => {
    const defaultDate = format(parseISO(appointment.startTime), 'yyyy-MM-dd');
    setRescheduleDate(defaultDate);
    setRescheduleSlot(undefined);
    setAvailability([]);
    setAction({ type: 'reschedule', appointment });
    setActionReason('');
    setActionError(null);
  };

  const closeAction = () => {
    setAction(null);
    setActionReason('');
    setActionError(null);
    setRescheduleSlot(undefined);
    setAvailability([]);
  };

  const submitCancel = async () => {
    if (!action) return;
    const phoneToSubmit = phone.trim();
    setLoadingAction(true);
    setActionError(null);
    try {
      await api.patch(`/appointments/${action.appointment.id}/cancel-by-customer`, {
        phone: phoneToSubmit,
        reason: actionReason.trim() || undefined,
      });
      setFeedback('Agendamento cancelado com sucesso.');
      closeAction();
      await fetchAppointments();
    } catch (err: any) {
      console.error(err);
      setActionError(resolveApiError(err, 'Nao foi possivel cancelar o agendamento.'));
    } finally {
      setLoadingAction(false);
    }
  };

  const submitReschedule = async () => {
    if (!action) return;
    if (!rescheduleSlot) {
      setActionError('Escolha um novo horario.');
      return;
    }

    const phoneToSubmit = phone.trim();
    setLoadingAction(true);
    setActionError(null);
    try {
      await api.post(`/appointments/${action.appointment.id}/reschedule`, {
        phone: phoneToSubmit,
        newStartTime: rescheduleSlot,
        reason: actionReason.trim() || undefined,
      });
      setFeedback('Agendamento remarcado com sucesso!');
      closeAction();
      await fetchAppointments();
    } catch (err: any) {
      console.error(err);
      setActionError(resolveApiError(err, 'Nao foi possivel remarcar. Tente outro horario.'));
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div>
      <div className="section-title">Meus agendamentos</div>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Informe seu telefone para ver os seus 5 ultimos agendamentos.
      </p>

      <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={handleSubmit}>
        <label>
          Telefone com DDD
          <input
            ref={phoneInputRef}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(11) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>

        <div className="inline-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSearch}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setAppointments([]);
              setSearched(false);
              setError(null);
              setFeedback(null);
            }}
            disabled={loading}
          >
            Limpar
          </button>
        </div>
      </form>

      {feedback && (
        <div className="status-banner success" style={{ marginTop: '1rem' }}>
          {feedback}
        </div>
      )}

      {error && (
        <div className="status-banner error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {!error && searched && appointments.length === 0 && (
        <div className="status-banner" style={{ marginTop: '1rem' }}>
          Nenhum agendamento encontrado para este telefone.
        </div>
      )}

      {appointments.length > 0 && (
        <div className="table-responsive" style={{ marginTop: '1rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horario</th>
                <th>Servico</th>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {appointments.slice(0, 5).map((appointment) => {
                const date = parseISO(appointment.startTime);
                const isActiveAction = action?.appointment.id === appointment.id && loadingAction;
                return (
                  <tr key={appointment.id}>
                    <td data-label="Data">{format(date, 'dd/MM/yyyy')}</td>
                    <td data-label="Horario">{format(date, 'HH:mm')}</td>
                    <td data-label="Servico">
                      {haircutMap[appointment.haircutType] ?? appointment.haircutType}
                    </td>
                    <td data-label="Status">{statusLabel(appointment.status)}</td>
                    <td data-label="Acoes">
                      {appointment.canCancel || appointment.canReschedule ? (
                        <div className="inline-actions" style={{ gap: '0.5rem' }}>
                          {appointment.canCancel && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openCancel(appointment)}
                              disabled={loadingAction}
                            >
                              Cancelar
                            </button>
                          )}
                          {appointment.canReschedule && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => openReschedule(appointment)}
                              disabled={loadingAction}
                            >
                              Remarcar
                            </button>
                          )}
                          {isActiveAction && <small>Processando...</small>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {action && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="section-title">
            {action.type === 'cancel' ? 'Cancelar agendamento' : 'Remarcar agendamento'}
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            {format(parseISO(action.appointment.startTime), 'dd/MM/yyyy')} as{' '}
            {format(parseISO(action.appointment.startTime), 'HH:mm')} -{' '}
            {haircutMap[action.appointment.haircutType] ?? action.appointment.haircutType}
          </p>

          <div className="form-grid">
            <label>
              Motivo (opcional)
              <textarea
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                placeholder="Ex.: Nao vou conseguir comparecer"
              />
            </label>

            {action.type === 'reschedule' && (
              <>
                <label>
                  Nova data
                  <input
                    type="date"
                    min={todayIso}
                    value={rescheduleDate}
                    onChange={(event) => {
                      setRescheduleDate(event.target.value);
                      setRescheduleSlot(undefined);
                    }}
                  />
                </label>
                <div>
                  <div className="section-title">Escolha um horario</div>
                  {availabilityLoading ? (
                    <div className="status-banner" style={{ marginTop: '0.5rem' }}>
                      Carregando horarios...
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem' }}>
                      <AvailabilityGrid
                        slots={availability}
                        selectedSlot={rescheduleSlot}
                        onSelect={setRescheduleSlot}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {actionError && (
            <div className="status-banner error" style={{ marginTop: '0.5rem' }}>
              {actionError}
            </div>
          )}

          <div className="inline-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={action.type === 'cancel' ? submitCancel : submitReschedule}
              disabled={loadingAction || (action.type === 'reschedule' && !rescheduleSlot)}
            >
              {loadingAction
                ? 'Enviando...'
                : action.type === 'cancel'
                  ? 'Confirmar cancelamento'
                  : 'Confirmar remarcacao'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeAction}
              disabled={loadingAction}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
