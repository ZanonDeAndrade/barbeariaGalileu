import { Router } from 'express';
import { getAppointmentsSummaryHandler } from '../controllers/barberDashboard.controller.js';

const router = Router();

router.get('/dashboard/appointments-summary', getAppointmentsSummaryHandler);

export default router;
