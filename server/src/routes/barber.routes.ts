import { Router } from 'express';
import { getAppointmentsSummaryHandler } from '../controllers/barberDashboard.controller.js';
import {
  createBlockedSlotsBulkHandler,
  deleteBlockedSlotsBulkHandler,
} from '../controllers/blockedSlotController.js';
import { requireBarber } from '../middlewares/requireBarber.js';

const router = Router();

// Todo o router e area interna. O requireBarber e aplicado no nivel do router
// (default deny) para que uma rota nova adicionada aqui ja nasca protegida.
router.use(requireBarber);

/**
 * Verificacao da chave usada pelo barber-app na tela de acesso. Responde 200
 * apenas quando o requireBarber acima ja validou a chave, entao nao existe
 * caminho que retorne sucesso sem credencial. A contencao de brute force fica
 * dentro do proprio requireBarber (so tentativas invalidas sao contadas).
 */
router.get('/session', (_req, res) => {
  res.json({ ok: true });
});

router.get('/dashboard/appointments-summary', getAppointmentsSummaryHandler);
router.post('/blocked-slots/bulk', createBlockedSlotsBulkHandler);
router.delete('/blocked-slots/bulk', deleteBlockedSlotsBulkHandler);

export default router;
