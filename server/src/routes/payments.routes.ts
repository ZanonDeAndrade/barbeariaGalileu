import { Router } from 'express';
import {
  createCashAppointmentHandler,
  createPixPaymentHandler,
  paymentWebhookHandler,
  processCardPaymentHandler,
} from '../controllers/payments.controller.js';

const router = Router();

// Cartão (Checkout Transparente / Payment Brick)
router.post('/process-payment', processCardPaymentHandler);

// Pix
router.post('/payment/pix', createPixPaymentHandler);

// Dinheiro (cria agendamento com paymentStatus=pending)
router.post('/payment/cash', createCashAppointmentHandler);

// Webhook Mercado Pago
router.post('/webhook-pagamento', paymentWebhookHandler);

export default router;

