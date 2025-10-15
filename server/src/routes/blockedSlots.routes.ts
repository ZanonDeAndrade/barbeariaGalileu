import { Router } from 'express';
import {
  createBlockedSlotHandler,
  listBlockedSlotsHandler,
  removeBlockedSlotHandler,
} from '../controllers/blockedSlotController.js';

const router = Router();

router.get('/', listBlockedSlotsHandler);
router.post('/', createBlockedSlotHandler);
router.delete('/:id', removeBlockedSlotHandler);

export default router;
