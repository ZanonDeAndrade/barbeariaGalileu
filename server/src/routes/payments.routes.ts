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
import { requireBarberKey } from '../middlewares/requireBarberKey.js';

const router = Router();

// Cartão (Checkout Transparente / Payment Brick)
router.post('/process-payment', processCardPaymentHandler);

// Pix
router.post('/payment/pix', createPixPaymentHandler);

// Dinheiro (cria agendamento com paymentStatus=pending)
router.post('/payment/cash', createCashAppointmentHandler);

// Webhook Mercado Pago
router.post('/webhook-pagamento', mercadoPagoWebhookHandler);

// Sync manual (quando webhook falhar)
router.post('/barber/payments/:paymentId/sync', requireBarberKey, mercadoPagoSyncHandler);

export default router;
