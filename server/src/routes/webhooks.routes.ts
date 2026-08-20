import { Router } from 'express';
import { mercadoPagoWebhookHandler } from '../controllers/mercadopagoWebhookController.js';
import { verifyMercadoPagoSignature } from '../middlewares/verifyMercadoPagoSignature.js';

const router = Router();

// WEBHOOK: autenticado pela assinatura HMAC do Mercado Pago (x-signature).
router.post('/mercadopago', verifyMercadoPagoSignature, mercadoPagoWebhookHandler);

export default router;
