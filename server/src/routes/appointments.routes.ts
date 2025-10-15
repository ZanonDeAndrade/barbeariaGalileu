import { Router } from 'express';
import {
  createAppointmentHandler,
  getAvailabilityHandler,
  listAppointmentsHandler,
} from '../controllers/appointmentController.js';

const router = Router();

router.get('/availability', getAvailabilityHandler);
router.get('/', listAppointmentsHandler);
router.post('/', createAppointmentHandler);

export default router;
