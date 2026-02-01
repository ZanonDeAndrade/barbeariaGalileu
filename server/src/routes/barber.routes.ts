import { Router } from 'express';
import { getAppointmentsSummaryHandler } from '../controllers/barberDashboard.controller.js';
import {
  createBlockedSlotsBulkHandler,
  deleteBlockedSlotsBulkHandler,
} from '../controllers/blockedSlotController.js';
import { requireBarberKey } from '../middlewares/requireBarberKey.js';

const router = Router();

router.get('/dashboard/appointments-summary', getAppointmentsSummaryHandler);
router.post('/blocked-slots/bulk', requireBarberKey, createBlockedSlotsBulkHandler);
router.delete('/blocked-slots/bulk', requireBarberKey, deleteBlockedSlotsBulkHandler);

export default router;
