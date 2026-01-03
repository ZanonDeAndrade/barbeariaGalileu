import { Router } from 'express';
import {
  cancelAppointmentHandler,
  createAppointmentHandler,
  getAvailabilityHandler,
  listAppointmentsHandler,
} from '../controllers/appointmentController.js';
import { requireBarberKey } from '../middlewares/requireBarberKey.js';

const router = Router();

router.get('/availability', getAvailabilityHandler);
router.get('/', listAppointmentsHandler);
router.post('/', createAppointmentHandler);
router.patch('/:id/cancel', requireBarberKey, cancelAppointmentHandler);

export default router;
