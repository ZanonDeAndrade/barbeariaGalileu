import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { Appointment, HaircutOption } from '../types';

type BarberDashboardProps = {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onNavigateToBlocks: () => void;
};

const today = format(new Date(), 'yyyy-MM-dd');

function BarberDashboard({ selectedDate, onChangeDate, onNavigateToBlocks }: BarberDashboardProps) {
  const [haircuts, setHaircuts] = useState<HaircutOption[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
      setLoadingAppointments(true);
      setFeedback(null);

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
          message: 'Falha ao carregar os agendamentos.',
        });
      } finally {
        setLoadingAppointments(false);
      }
    }

    fetchInitialData();
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

  return (
    <div className="content-grid">
      <section>
        <h1 className="page-title">Área do barbeiro</h1>
        <p className="page-subtitle">
          Acompanhe os agendamentos confirmados e mantenha o dia organizado.
        </p>
      </section>

      <section className="card">
        <div className="flex-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="section-title">Controle diário</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Defina a data para visualizar os horários confirmados.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onNavigateToBlocks}>
            Bloquear horários
          </button>
        </div>
        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
          <label>
            Escolha a data
            <input
              type="date"
              min={today}
              value={selectedDate}
              onChange={(event) => onChangeDate(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Agendamentos do dia</div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Lista dos atendimentos confirmados para {readableSelectedDate}.
        </p>

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

export default BarberDashboard;
