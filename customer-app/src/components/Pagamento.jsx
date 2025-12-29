import { useEffect, useMemo, useRef, useState } from 'react';
import { paymentsApi } from '../services/payments';

export function Pagamento({ appointment, haircut, onClose, onSuccess }) {
  const [metodo, setMetodo] = useState('cartao');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pix, setPix] = useState(null);
  const [pixRequested, setPixRequested] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [mpReady, setMpReady] = useState(false);
  const brickRef = useRef(null);

  const amount = useMemo(() => {
    return haircut ? Math.max(1, Math.round(haircut.priceCents) / 100) : 1;
  }, [haircut]);

  // carrega SDK do Mercado Pago on-demand
  useEffect(() => {
    const existing = document.querySelector("script[src='https://sdk.mercadopago.com/js/v2']");
    if (existing) {
      if (window.MercadoPago) {
        setMpReady(true);
      } else {
        const onLoad = () => setMpReady(true);
        existing.addEventListener('load', onLoad);
        return () => existing.removeEventListener('load', onLoad);
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
      if (s.parentElement) s.parentElement.removeChild(s);
    };
  }, []);

  // inicializa o Payment Brick quando selecionar cartao
  useEffect(() => {
    if (metodo !== 'cartao') return;
    if (!mpReady || !window.MercadoPago) return;
    const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY || window.MP_PUBLIC_KEY;
    if (!publicKey) return;
    const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
    const bricksBuilder = mp.bricks();

    const render = async () => {
      const settings = {
        initialization: { amount },
        customization: { paymentMethods: { creditCard: 'all', debitCard: 'all' } },
        callbacks: {
          onReady: () => {},
          onError: (error) => {
            console.error('Payment Brick error:', error);
            setFeedback('Erro ao carregar formulário de pagamento.');
          },
          onSubmit: async ({ formData }) => {
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
      };
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
      setCopyState('idle');
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

  useEffect(() => {
    if (metodo !== 'pix') return;
    if (pix || loading || pixRequested) return;
    setPixRequested(true);
    handlePix();
  }, [metodo, pix, loading, pixRequested]);

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

  const handleCopyPix = async () => {
    if (!(pix && pix.qr)) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(pix.qr);
      } else {
        const helper = document.createElement('textarea');
        helper.value = pix.qr;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error(error);
      setCopyState('error');
    }
  };

  return (
    <div className="card" role="dialog" aria-modal="true">
      <div className="section-title">Pagamento</div>
      <div className="legend" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${metodo === 'cartao' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMetodo('cartao');
            setFeedback(null);
            setCopyState('idle');
            setPixRequested(false);
          }}
        >
          Cartao
        </button>
        <button
          type="button"
          className={`btn ${metodo === 'pix' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMetodo('pix');
            setFeedback(null);
            setPix(null);
            setPixRequested(false);
            setCopyState('idle');
          }}
        >
          Pix
        </button>
        <button
          type="button"
          className={`btn ${metodo === 'dinheiro' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMetodo('dinheiro');
            setFeedback(null);
            setCopyState('idle');
            setPixRequested(false);
          }}
        >
          Dinheiro
        </button>
      </div>

      {metodo === 'cartao' && (
        <div style={{ display: 'grid', gap: '0.75rem', overflow: 'hidden', minWidth: 0 }}>
          <small className="form-helper">
            Pagamento com cartao de credito ou debito de qualquer banco. Para cartao virtual Caixa, use a opcao de debito
            no formulario abaixo.
          </small>
          <div className="payment-brick-wrapper">
            <div id="payment_brick_container" />
          </div>
        </div>
      )}

      {metodo === 'pix' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {!pix && <div className="status-banner">{loading ? 'Gerando Pix...' : 'Gerando QR Code Pix...'}</div>}

          {pix?.img && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                alt="QR Code Pix"
                src={`data:image/png;base64,${pix.img}`}
                style={{ width: 180, height: 180, borderRadius: 8 }}
              />
            </div>
          )}

          {pix?.qr && (
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 360, margin: '0 auto', width: '100%' }}>
              <textarea
                readOnly
                value={pix.qr}
                style={{ width: '100%', height: 80, textAlign: 'center', fontSize: '0.9rem' }}
              />
              <button className="btn btn-secondary" onClick={handleCopyPix} type="button">
                {copyState === 'copied'
                  ? 'Chave Pix copiada'
                  : copyState === 'error'
                    ? 'Tente copiar novamente'
                    : 'Copiar chave Pix'}
              </button>
            </div>
          )}
        </div>
      )}

      {metodo === 'dinheiro' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div className="status-banner">Seu horário será reservado com pagamento pendente no caixa.</div>
          <button className="btn btn-primary" onClick={handleCash} disabled={loading} style={{ marginTop: '0.25rem' }}>
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
