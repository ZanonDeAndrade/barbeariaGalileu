import { Router } from 'express';
import {
  getPublicKeyHandler,
  getStatusHandler,
  runRemindersHandler,
  subscribeBarberHandler,
  subscribeCustomerHandler,
  unsubscribeHandler,
} from '../controllers/push.controller.js';
import { requireBarberKeyStrict } from '../middlewares/requireBarberKeyStrict.js';
import { requireCronKey } from '../middlewares/requireCronKey.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const router = Router();

const subscribeRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 60 });

router.get('/public-key', getPublicKeyHandler);
router.get('/status', getStatusHandler);

// Inscricao do cliente: identidade derivada do telefone no servidor.
router.post('/subscribe', subscribeRateLimit, subscribeCustomerHandler);

// Inscricao do barbeiro: fail-closed — exige BARBER_API_KEY configurada e
// correta (evita inscricao anonima recebendo notificacoes do barbeiro).
router.post('/barber/subscribe', requireBarberKeyStrict, subscribeBarberHandler);

router.delete('/unsubscribe', unsubscribeHandler);

// Disparo da rotina de lembretes (Cloud Scheduler / GitHub Actions / cron).
router.post('/run-reminders', requireCronKey, runRemindersHandler);

export default router;
