import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import type { HaircutOption, MonthlyAppointmentsSummary } from '../types';

type MonthlyMetricsPageProps = {
  defaultMonth?: string;
  onBack: () => void;
};

const currentMonth = format(new Date(), 'yyyy-MM');
const monthLabels = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

function parseMonthValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

function formatMonthLabel(value: string) {
  const parsed = parseMonthValue(value);
  if (!parsed) return value;
  return `${monthLabels[parsed.getMonth()]}/${parsed.getFullYear()}`;
}

function buildMonthOptions(referenceMonth: string) {
  const referenceDate = parseMonthValue(referenceMonth) ?? new Date();
  const options: Array<{ value: string; label: string }> = [];

  for (let diff = 12; diff >= -24; diff -= 1) {
    const date = new Date(referenceDate);
    date.setMonth(referenceDate.getMonth() + diff);
    const value = format(date, 'yyyy-MM');
    options.push({ value, label: formatMonthLabel(value) });
  }

  return options;
}

function MonthlyMetricsPage({ defaultMonth, onBack }: MonthlyMetricsPageProps) {
  const referenceMonth = defaultMonth ?? currentMonth;
  const [haircuts, setHaircuts] = useState<HaircutOption[]>([]);
  const [summaryMonth, setSummaryMonth] = useState(referenceMonth);
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyAppointmentsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

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

  const fetchMonthlySummary = async (options: { silent?: boolean } = {}) => {
    if (!summaryMonth) {
      setMonthlySummary(null);
      return;
    }

    const silent = options.silent ?? false;
    if (!silent) {
      setLoadingSummary(true);
      setSummaryError(null);
    }

    try {
      const response = await api.get<MonthlyAppointmentsSummary>('/barber/dashboard/appointments-summary', {
        params: {
          month: summaryMonth,
          includeCanceled: includeCanceled ? 'true' : 'false',
        },
      });
      if (!isMountedRef.current) return;
      setMonthlySummary(response.data);
    } catch (error) {
      console.error(error);
      if (!silent && isMountedRef.current) {
        setSummaryError('Falha ao carregar as métricas mensais.');
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setLoadingSummary(false);
      }
    }
  };

  useEffect(() => {
    fetchHaircuts();
  }, []);

  useEffect(() => {
    fetchMonthlySummary();
  }, [summaryMonth, includeCanceled]);

  const haircutMap = useMemo(
    () => Object.fromEntries(haircuts.map((item) => [item.id, item.name])),
    [haircuts],
  );

  const monthOptions = useMemo(() => buildMonthOptions(referenceMonth), [referenceMonth]);

  return (
    <div className="content-grid">
      <section>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Voltar
        </button>
      </section>

      <section>
        <h1 className="page-title">Métricas mensais</h1>
        <p className="page-subtitle">Total e distribuição de agendamentos no mês (America/Sao_Paulo).</p>
      </section>

      <section className="card card--dark">
        <div className="flex-between" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <div className="section-title">Resumo do mês</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Selecione o mês para consultar os totais.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => fetchMonthlySummary()} disabled={loadingSummary}>
            Atualizar
          </button>
        </div>

        <div
          className="form-grid"
          style={{ marginTop: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          <label>
            Mês
            <select value={summaryMonth} onChange={(event) => setSummaryMonth(event.target.value)}>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1.75rem' }}>
            <input
              type="checkbox"
              checked={includeCanceled}
              onChange={(event) => setIncludeCanceled(event.target.checked)}
            />
            Incluir cancelados
          </label>
        </div>

        {loadingSummary ? (
          <div className="status-banner" style={{ marginTop: '1rem' }}>
            Carregando métricas...
          </div>
        ) : summaryError ? (
          <div className="status-banner error" style={{ marginTop: '1rem' }}>
            {summaryError}
          </div>
        ) : monthlySummary ? (
          <div style={{ marginTop: '1.25rem' }}>
            <div
              className="status-banner"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}
            >
              <div>Total no mês</div>
              <strong>{monthlySummary.total}</strong>
            </div>

            <div
              style={{
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <div className="section-title">Por serviço</div>
                {monthlySummary.byService.length === 0 ? (
                  <div className="status-banner" style={{ marginTop: '0.75rem' }}>
                    Sem dados.
                  </div>
                ) : (
                  <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Serviço</th>
                          <th>Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummary.byService.map((item) => (
                          <tr key={item.haircutType}>
                            <td data-label="Serviço">{haircutMap[item.haircutType] ?? item.haircutType}</td>
                            <td data-label="Qtd">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="status-banner" style={{ marginTop: '1rem' }}>
            Selecione um mês para visualizar as métricas.
          </div>
        )}
      </section>
    </div>
  );
}

export default MonthlyMetricsPage;
