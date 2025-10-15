import { Router } from 'express';
import {
  getHaircutsHandler,
} from '../controllers/appointmentController.js';
import appointmentsRouter from './appointments.routes.js';
import blockedSlotsRouter from './blockedSlots.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/haircuts', getHaircutsHandler);
router.use('/appointments', appointmentsRouter);
router.use('/blocked-slots', blockedSlotsRouter);

export default router;
