import { Router } from 'express';
import { mercadoPagoWebhookHandler } from '../controllers/mercadopagoWebhookController.js';

const router = Router();

router.post('/mercadopago', mercadoPagoWebhookHandler);

export default router;

