import { Router } from 'express';
import {
  createCashAppointmentHandler,
  createPixPaymentHandler,
  processCardPaymentHandler,
} from '../controllers/payments.controller.js';
import {
  mercadoPagoSyncHandler,
  mercadoPagoWebhookHandler,
} from '../controllers/mercadopagoWebhookController.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { requireBarber } from '../middlewares/requireBarber.js';
import { verifyMercadoPagoSignature } from '../middlewares/verifyMercadoPagoSignature.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const checkoutRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });

// PUBLIC (checkout do cliente). Os handlers vao encapsulados em asyncHandler:
// sem isso, uma rejeicao (ex.: erro de validacao) vira unhandledRejection e a
// requisicao fica pendurada ate o timeout em vez de responder 400.
router.post('/process-payment', checkoutRateLimit, asyncHandler(processCardPaymentHandler));

// Pix
router.post('/payment/pix', checkoutRateLimit, asyncHandler(createPixPaymentHandler));

// Dinheiro (cria agendamento com paymentStatus=pending)
router.post('/payment/cash', checkoutRateLimit, asyncHandler(createCashAppointmentHandler));

// WEBHOOK Mercado Pago (rota legada; a canonica e POST /webhooks/mercadopago)
router.post('/webhook-pagamento', verifyMercadoPagoSignature, mercadoPagoWebhookHandler);

// BARBER: sync manual (quando o webhook falhar). Devolve o agendamento
// completo, com dados pessoais do cliente — nunca pode ser publica.
router.post('/barber/payments/:paymentId/sync', requireBarber, mercadoPagoSyncHandler);

export default router;
