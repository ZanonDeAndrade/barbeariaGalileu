import { Router } from 'express';
import {
  createBlockedSlotHandler,
  listBlockedSlotsHandler,
  removeBlockedSlotHandler,
} from '../controllers/blockedSlotController.js';
import { requireBarber } from '../middlewares/requireBarber.js';

const router = Router();

// BARBER em todas as rotas: a listagem expoe o motivo do bloqueio (agenda
// pessoal do barbeiro) e as mutacoes permitem derrubar a agenda inteira.
// O cliente nao precisa deste recurso — GET /api/appointments/availability ja
// devolve os horarios bloqueados sem expor o motivo.
router.use(requireBarber);

router.get('/', listBlockedSlotsHandler);
router.post('/', createBlockedSlotHandler);
router.delete('/:id', removeBlockedSlotHandler);

export default router;
