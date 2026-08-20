import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../services/api';
import { setBarberApiKey } from '../services/barberAuth';

/**
 * Tela de acesso do painel. A chave digitada e validada no servidor
 * (GET /api/barber/session) antes de ser guardada — nao existe validacao local
 * que possa ser burlada, e guardar a chave nao concede acesso a nada: cada
 * requisicao seguinte e reautorizada pelo backend.
 */
export function BarberLogin() {
  const [key, setKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Informe a chave de acesso.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.get('/barber/session', { headers: { 'x-barber-api-key': trimmed } });
      setBarberApiKey(trimmed);
    } catch (requestError) {
      const status = (requestError as any)?.response?.status;
      const code = (requestError as any)?.response?.data?.code;

      if (code === 'BARBER_KEY_MISSING') {
        setError('O servidor está sem BARBER_API_KEY configurada. Fale com o responsável pelo deploy.');
      } else if (status === 401 || status === 403) {
        setError('Chave de acesso inválida.');
      } else if (status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setError('Não foi possível validar a chave agora. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h1 className="page-title">Acesso restrito</h1>
      <p className="page-subtitle">
        Este painel mostra os dados dos clientes da barbearia. Informe a chave de acesso para
        continuar.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label htmlFor="barber-key">Chave de acesso</label>
        <input
          id="barber-key"
          type="password"
          value={key}
          autoComplete="current-password"
          onChange={(event) => setKey(event.target.value)}
          disabled={submitting}
        />

        {error ? <div className="status-banner error">{error}</div> : null}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Validando...' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}

export default BarberLogin;
