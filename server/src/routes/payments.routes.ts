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

const router = Router();


router.post('/process-payment', processCardPaymentHandler);

// Pix
router.post('/payment/pix', createPixPaymentHandler);

// Dinheiro (cria agendamento com paymentStatus=pending)
router.post('/payment/cash', createCashAppointmentHandler);

// Webhook Mercado Pago
router.post('/webhook-pagamento', mercadoPagoWebhookHandler);

// Sync manual (quando webhook falhar)
router.post('/barber/payments/:paymentId/sync', mercadoPagoSyncHandler);

export default router;
