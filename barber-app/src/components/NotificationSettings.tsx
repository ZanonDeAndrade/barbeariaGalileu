import { useEffect, useState } from 'react';
import {
  detectSupport,
  disablePush,
  enablePush,
  ensurePushContext,
  getPermission,
  isEnabled,
} from '../services/push';
import type { EnableResult } from '../services/push';

type Status = 'loading' | 'unsupported' | 'ios-needs-install' | 'denied' | 'disabled' | 'enabled';

function messageForFailure(reason: Exclude<EnableResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'permission-denied':
      return 'Você bloqueou as notificações neste navegador. Altere a permissão nas configurações para ativá-las.';
    case 'unsupported':
      return 'Este dispositivo não oferece suporte a notificações.';
    case 'ios-needs-install':
      return 'Adicione o painel à Tela de Início do seu iPhone ou iPad para ativar as notificações.';
    case 'not-configured':
      return 'As notificações ainda não estão disponíveis. Tente novamente mais tarde.';
    default:
      return 'Não foi possível ativar as notificações. Tente novamente.';
  }
}

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    (async () => {
      const support = detectSupport();
      if (support.supported !== true) {
        if (active) setStatus(support.reason);
        return;
      }

      if (getPermission() === 'denied') {
        if (active) setStatus('denied');
        return;
      }

      const enabled = await isEnabled();
      if (active) setStatus(enabled ? 'enabled' : 'disabled');
      if (enabled) {
        void ensurePushContext();
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await enablePush();
    if (result.ok) {
      setStatus('enabled');
      setFeedback({ type: 'success', message: 'Notificações ativadas com sucesso.' });
    } else {
      if (result.reason === 'permission-denied') setStatus('denied');
      if (result.reason === 'unsupported') setStatus('unsupported');
      if (result.reason === 'ios-needs-install') setStatus('ios-needs-install');
      setFeedback({ type: 'error', message: messageForFailure(result.reason) });
    }
    setBusy(false);
  };

  const handleDisable = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await disablePush();
    if (result.ok) {
      setStatus('disabled');
      setFeedback({ type: 'success', message: 'Notificações desativadas.' });
    } else {
      setFeedback({ type: 'error', message: 'Não foi possível desativar as notificações.' });
    }
    setBusy(false);
  };

  if (status === 'loading') {
    return null;
  }

  return (
    <section className="card card--dark">
      <div className="section-title">Notificações</div>

      {status === 'unsupported' && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Este dispositivo não oferece suporte a notificações.
        </p>
      )}

      {status === 'ios-needs-install' && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Para receber avisos no iPhone ou iPad, adicione este painel à Tela de Início e abra por lá
          antes de ativar as notificações.
        </p>
      )}

      {status === 'denied' && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Você bloqueou as notificações neste navegador. Altere a permissão nas configurações do
          navegador para ativá-las.
        </p>
      )}

      {status === 'disabled' && (
        <>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            Receba avisos de novos agendamentos, cancelamentos, alterações e lembretes dos próximos
            atendimentos.
          </p>
          <div className="inline-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={handleEnable} disabled={busy}>
              {busy ? 'Ativando...' : 'Ativar notificações'}
            </button>
          </div>
        </>
      )}

      {status === 'enabled' && (
        <>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            Notificações ativadas neste dispositivo.
          </p>
          <div className="inline-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleDisable} disabled={busy}>
              {busy ? 'Desativando...' : 'Desativar notificações'}
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div className={`status-banner ${feedback.type}`} style={{ marginTop: '1rem' }}>
          {feedback.message}
        </div>
      )}
    </section>
  );
}
