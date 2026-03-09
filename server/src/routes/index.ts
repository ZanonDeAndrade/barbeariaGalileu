import { Router } from 'express';
import {
  getHaircutsHandler,
} from '../controllers/appointments.controller.js';
import appointmentsRouter from './appointments.routes.js';
import barberRouter from './barber.routes.js';
import blockedSlotsRouter from './blockedSlots.routes.js';
import paymentsRouter from './payments.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

router.get('/haircuts', getHaircutsHandler);
router.use('/appointments', appointmentsRouter);
router.use('/barber', barberRouter);
router.use('/blocked-slots', blockedSlotsRouter);
// Rotas de pagamento (endereços conforme especificado):
router.use('/', paymentsRouter);

export default router;
