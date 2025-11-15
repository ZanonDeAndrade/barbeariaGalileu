import { useEffect, useMemo, useRef, useState } from 'react';
import type { CreateAppointmentPayload, HaircutOption } from '../types';
import { paymentsApi } from '../services/payments';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

type Metodo = 'cartao' | 'pix' | 'dinheiro';

type PagamentoProps = {
  appointment: CreateAppointmentPayload;
  haircut?: HaircutOption | null; // para obter valor
  onClose: () => void;
  onSuccess: (info: { appointmentId?: string; status: string }) => void;
};

export function Pagamento({ appointment, haircut, onClose, onSuccess }: PagamentoProps) {
  const [metodo, setMetodo] = useState<Metodo>('cartao');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qr?: string; img?: string; mpPaymentId?: string } | null>(null);
  const [mpReady, setMpReady] = useState(false);
  const brickRef = useRef<any>(null);

  const amount = useMemo(() => {
    return haircut ? Math.max(1, Math.round(haircut.priceCents) / 100) : 1;
  }, [haircut]);

  // carrega SDK do Mercado Pago on-demand
  useEffect(() => {
    const existing = document.querySelector("script[src='https://sdk.mercadopago.com/js/v2']") as HTMLScriptElement | null;
    if (existing) {
      if (window.MercadoPago) {
        setMpReady(true);
      } else {
        const onLoad = () => setMpReady(true);
        existing.addEventListener('load', onLoad);
        return () => {
          existing.removeEventListener('load', onLoad);
        };
      }
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.async = true;
    const onLoad = () => setMpReady(true);
    s.addEventListener('load', onLoad);
    document.body.appendChild(s);
    return () => {
      s.removeEventListener('load', onLoad);
      if (s && s.parentElement) s.parentElement.removeChild(s);
    };
  }, []);

  // inicializa o Payment Brick quando selecionar cartão
  useEffect(() => {
    if (metodo !== 'cartao') return;
    if (!mpReady || !window.MercadoPago) return;
    const publicKey = (import.meta as any).env.VITE_MP_PUBLIC_KEY || (window as any).MP_PUBLIC_KEY;
    if (!publicKey) return;
    const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
    const bricksBuilder = mp.bricks();

    const render = async () => {
      const settings = {
        initialization: {
          amount,
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
          },
        },
        callbacks: {
          onReady: () => {},
          onError: (error: any) => {
            console.error('Payment Brick error:', error);
            setFeedback('Erro ao carregar formulário de pagamento.');
          },
          onSubmit: async ({ formData }: { formData: any }) => {
            try {
              setFeedback(null);
              setLoading(true);
              const result = await paymentsApi.processCard({
                amount,
                description: 'Agendamento de serviço',
                appointment,
                cardPayload: formData,
              });
              if (result.status === 'approved') {
                onSuccess({ appointmentId: result.appointmentId, status: result.status });
              } else {
                setFeedback(`Pagamento ${result.status}.`);
              }
            } catch (e) {
              console.error(e);
              setFeedback('Não foi possível processar o pagamento.');
            } finally {
              setLoading(false);
            }
          },
        },
      } as any;
      try {
        const controller = await bricksBuilder.create('payment', 'payment_brick_container', settings);
        brickRef.current = controller;
      } catch (error) {
        console.error(error);
        setFeedback('Erro ao carregar formulário de pagamento.');
      }
    };

    render();
    return () => {
      if (brickRef.current && typeof brickRef.current.unmount === 'function') {
        brickRef.current.unmount();
        brickRef.current = null;
      } else {
        try {
          bricksBuilder.unmount('payment_brick_container');
        } catch {
          // ignore
        }
      }
    };
  }, [metodo, amount, mpReady]);

  const handlePix = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const payerEmail = `${appointment.customerPhone.replace(/\D/g, '')}@example.com`;
      const result = await paymentsApi.createPix({
        amount,
        description: 'Agendamento de serviço',
        appointment,
        payer: { email: payerEmail, first_name: appointment.customerName.split(' ')[0] },
      });
      setPix({ qr: result.qr_code, img: result.qr_code_base64, mpPaymentId: result.mpPaymentId });
      setFeedback('Escaneie o QR Code no seu banco. Confirmaremos automaticamente quando aprovado.');
    } catch (e) {
      console.error(e);
      setFeedback('Erro ao gerar Pix.');
    } finally {
      setLoading(false);
    }
  };

  const handleCash = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const result = await paymentsApi.cash(appointment);
      onSuccess({ appointmentId: result.appointmentId, status: result.status });
    } catch (e) {
      console.error(e);
      setFeedback('Não foi possível confirmar em dinheiro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" role="dialog" aria-modal="true">
      <div className="section-title">Pagamento</div>
      <div className="legend" style={{ marginBottom: '1rem' }}>
        <button
          className={`btn ${metodo === 'cartao' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMetodo('cartao');
            setFeedback(null);
          }}
        >
          Cartão (crédito / débito)
        </button>
        <button
          className={`btn ${metodo === 'pix' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMetodo('pix');
            setFeedback(null);
          }}
        >
          Pix
        </button>
        <button
          className={`btn ${metodo === 'dinheiro' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMetodo('dinheiro');
            setFeedback(null);
          }}
        >
          Dinheiro
        </button>
      </div>

      {metodo === 'cartao' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <small className="form-helper">
            Pagamento com cartão de crédito ou débito de qualquer banco. Para cartão virtual Caixa, use a opção de débito
            no formulário abaixo.
          </small>
          <div id="payment_brick_container" />
        </div>
      )}

      {metodo === 'pix' && (
        <div>
          {!pix ? (
            <button className="btn btn-primary" onClick={handlePix} disabled={loading}>
              {loading ? 'Gerando Pix...' : 'Gerar QR Code Pix'}
            </button>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {pix.img && (
                <img alt="QR Code Pix" src={`data:image/png;base64,${pix.img}`} style={{ width: 220, height: 220 }} />
              )}
              {pix.qr && (
                <textarea readOnly value={pix.qr} style={{ width: '100%', height: 80 }} />
              )}
            </div>
          )}
        </div>
      )}

      {metodo === 'dinheiro' && (
        <div>
          <div className="status-banner">Seu horário será reservado com pagamento pendente no caixa.</div>
          <button className="btn btn-primary" onClick={handleCash} disabled={loading}>
            {loading ? 'Confirmando...' : 'Confirmar em dinheiro'}
          </button>
        </div>
      )}

      {feedback && <div className="status-banner" style={{ marginTop: '1rem' }}>{feedback}</div>}

      <div className="inline-actions" style={{ marginTop: '1rem' }}>
        <button className="btn btn-secondary" onClick={onClose}>Voltar</button>
      </div>
    </div>
  );
}

export default Pagamento;
