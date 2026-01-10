import { Router } from 'express';
import {
  cancelAppointmentHandler,
  createAppointmentHandler,
  getAvailabilityHandler,
  listAppointmentsByPhoneHandler,
  listAppointmentsHandler,
} from '../controllers/appointments.controller.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const router = Router();

router.get('/availability', getAvailabilityHandler);
router.post('/by-phone', rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }), listAppointmentsByPhoneHandler);
router.get('/', listAppointmentsHandler);
router.post('/', createAppointmentHandler);
router.patch('/:id/cancel', cancelAppointmentHandler);

export default router;
