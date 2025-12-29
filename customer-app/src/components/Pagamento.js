import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
            }
            else {
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
            if (s && s.parentElement)
                s.parentElement.removeChild(s);
        };
    }, []);
    // inicializa o Payment Brick quando selecionar cartão
    useEffect(() => {
        if (metodo !== 'cartao')
            return;
        if (!mpReady || !window.MercadoPago)
            return;
        const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY || window.MP_PUBLIC_KEY;
        if (!publicKey)
            return;
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
                    onReady: () => { },
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
                            }
                            else {
                                setFeedback(`Pagamento ${result.status}.`);
                            }
                        }
                        catch (e) {
                            console.error(e);
                            setFeedback('Não foi possível processar o pagamento.');
                        }
                        finally {
                            setLoading(false);
                        }
                    },
                },
            };
            try {
                const controller = await bricksBuilder.create('payment', 'payment_brick_container', settings);
                brickRef.current = controller;
            }
            catch (error) {
                console.error(error);
                setFeedback('Erro ao carregar formulário de pagamento.');
            }
        };
        render();
        return () => {
            if (brickRef.current && typeof brickRef.current.unmount === 'function') {
                brickRef.current.unmount();
                brickRef.current = null;
            }
            else {
                try {
                    bricksBuilder.unmount('payment_brick_container');
                }
                catch {
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
        }
        catch (e) {
            console.error(e);
            setFeedback('Erro ao gerar Pix.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (metodo !== 'pix')
            return;
        if (pix || loading || pixRequested)
            return;
        setPixRequested(true);
        handlePix();
    }, [metodo, pix, loading, pixRequested]);
    const handleCash = async () => {
        try {
            setLoading(true);
            setFeedback(null);
            const result = await paymentsApi.cash(appointment);
            onSuccess({ appointmentId: result.appointmentId, status: result.status });
        }
        catch (e) {
            console.error(e);
            setFeedback('Não foi possível confirmar em dinheiro.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleCopyPix = async () => {
        if (!pix?.qr)
            return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(pix.qr);
            }
            else {
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
        }
        catch (error) {
            console.error(error);
            setCopyState('error');
        }
    };
    return (_jsxs("div", { className: "card", role: "dialog", "aria-modal": "true", children: [_jsx("div", { className: "section-title", children: "Pagamento" }), _jsxs("div", { className: "legend", style: { marginBottom: '1rem' }, children: [_jsx("button", { type: "button", className: `btn ${metodo === 'cartao' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => {
                            setMetodo('cartao');
                            setFeedback(null);
                            setCopyState('idle');
                            setPixRequested(false);
                        }, children: "Cart\u00E3o" }), _jsx("button", { type: "button", className: `btn ${metodo === 'pix' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => {
                            setMetodo('pix');
                            setFeedback(null);
                            setPix(null);
                            setPixRequested(false);
                            setCopyState('idle');
                        }, children: "Pix" }), _jsx("button", { type: "button", className: `btn ${metodo === 'dinheiro' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => {
                            setMetodo('dinheiro');
                            setFeedback(null);
                            setCopyState('idle');
                            setPixRequested(false);
                        }, children: "Dinheiro" })] }), metodo === 'cartao' && (_jsxs("div", { style: { display: 'grid', gap: '0.75rem', overflow: 'hidden', minWidth: 0 }, children: [_jsx("small", { className: "form-helper", children: "Pagamento com cart\u00E3o de cr\u00E9dito ou d\u00E9bito de qualquer banco. Para cart\u00E3o virtual Caixa, use a op\u00E7\u00E3o de d\u00E9bito no formul\u00E1rio abaixo." }), _jsx("div", { className: "payment-brick-wrapper", children: _jsx("div", { id: "payment_brick_container" }) })] })), metodo === 'pix' && (_jsxs("div", { style: { display: 'grid', gap: '0.75rem' }, children: [!pix && (_jsx("div", { className: "status-banner", children: loading ? 'Gerando Pix...' : 'Gerando QR Code Pix...' })), pix?.img && (_jsx("div", { style: { display: 'flex', justifyContent: 'center' }, children: _jsx("img", { alt: "QR Code Pix", src: `data:image/png;base64,${pix.img}`, style: { width: 180, height: 180, borderRadius: 8 } }) })), pix?.qr && (_jsxs("div", { style: { display: 'grid', gap: '0.5rem', maxWidth: 360, margin: '0 auto', width: '100%' }, children: [_jsx("textarea", { readOnly: true, value: pix.qr, style: { width: '100%', height: 80, textAlign: 'center', fontSize: '0.9rem' } }), _jsx("button", { className: "btn btn-secondary", onClick: handleCopyPix, type: "button", children: copyState === 'copied'
                                    ? 'Chave Pix copiada'
                                    : copyState === 'error'
                                        ? 'Tente copiar novamente'
                                        : 'Copiar chave Pix' })] }))] })), metodo === 'dinheiro' && (_jsxs("div", { style: { display: 'grid', gap: '0.75rem' }, children: [_jsx("div", { className: "status-banner", children: "Seu hor\u00E1rio ser\u00E1 reservado com pagamento pendente no caixa." }), _jsx("button", { className: "btn btn-primary", onClick: handleCash, disabled: loading, style: { marginTop: '0.25rem' }, children: loading ? 'Confirmando...' : 'Confirmar em dinheiro' })] })), feedback && _jsx("div", { className: "status-banner", style: { marginTop: '1rem' }, children: feedback }), _jsx("div", { className: "inline-actions", style: { marginTop: '1rem' }, children: _jsx("button", { className: "btn btn-secondary", onClick: onClose, children: "Voltar" }) })] }));
}
export default Pagamento;
