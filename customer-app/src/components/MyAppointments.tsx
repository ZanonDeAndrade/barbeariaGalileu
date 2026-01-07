import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import type { CustomerAppointmentSummary, HaircutOption } from '../types';

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function statusLabel(status: CustomerAppointmentSummary['status']) {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmado';
    case 'CANCELLED':
      return 'Cancelado';
    case 'SCHEDULED':
    default:
      return 'Agendado';
  }
}

type MyAppointmentsProps = {
  haircuts: HaircutOption[];
};

export function MyAppointments({ haircuts }: MyAppointmentsProps) {
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('customerPhone') ?? '';
    } catch {
      return '';
    }
  });
  const [appointments, setAppointments] = useState<CustomerAppointmentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const didAutoSearch = useRef(false);

  const haircutMap = useMemo(
    () => Object.fromEntries(haircuts.map((item) => [item.id, item.name])),
    [haircuts],
  );

  const canSearch = useMemo(() => normalizePhone(phone).length >= 8 && !loading, [phone, loading]);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ appointments: CustomerAppointmentSummary[] }>(
        '/appointments/by-phone',
        { phone, limit: 5 },
      );
      setAppointments(response.data.appointments ?? []);
      setSearched(true);
      try {
        localStorage.setItem('customerPhone', normalizePhone(phone));
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      setError('Não foi possível buscar seus agendamentos. Verifique o telefone e tente novamente.');
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) return;
    void fetchAppointments();
  };

  return (
    <div>
      <div className="section-title">Meus agendamentos</div>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Informe seu telefone para ver os seus 5 últimos agendamentos.
      </p>

      <form className="form-grid" style={{ marginTop: '1rem' }} onSubmit={handleSubmit}>
        <label>
          Telefone com DDD
          <input
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
            }}
            disabled={loading}
          >
            Limpar
          </button>
        </div>
      </form>

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
                <th>Horário</th>
                <th>Serviço</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.slice(0, 5).map((appointment) => {
                const date = parseISO(appointment.startTime);
                return (
                  <tr key={appointment.id}>
                    <td data-label="Data">{format(date, 'dd/MM/yyyy')}</td>
                    <td data-label="Horário">{format(date, 'HH:mm')}</td>
                    <td data-label="Serviço">
                      {haircutMap[appointment.haircutType] ?? appointment.haircutType}
                    </td>
                    <td data-label="Status">{statusLabel(appointment.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
