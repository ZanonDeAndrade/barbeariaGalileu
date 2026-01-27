import { Router } from 'express';
import {
  cancelAppointmentHandler,
  cancelAppointmentByCustomerHandler,
  createAppointmentHandler,
  getAvailabilityHandler,
  listAppointmentsByPhoneHandler,
  listAppointmentsHandler,
  rescheduleAppointmentHandler,
} from '../controllers/appointments.controller.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const router = Router();

router.get('/availability', getAvailabilityHandler);
router.post('/by-phone', rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }), listAppointmentsByPhoneHandler);
router.get('/', listAppointmentsHandler);
router.post('/', createAppointmentHandler);
router.patch('/:id/cancel', cancelAppointmentHandler);
router.patch('/:id/cancel-by-customer', cancelAppointmentByCustomerHandler);
router.post('/:id/reschedule', rescheduleAppointmentHandler);

export default router;
