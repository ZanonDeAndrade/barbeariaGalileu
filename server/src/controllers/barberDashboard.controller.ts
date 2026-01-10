import type { Request, Response } from 'express';
import { appointmentsSummaryQuerySchema } from '../schemas/barberDashboard.schema.js';
import { getMonthlyAppointmentsSummary } from '../services/barberDashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/barber/dashboard/appointments-summary?month=YYYY-MM&includeCanceled=true|false
 * Response:
 * {
 *   month: "YYYY-MM",
 *   total: number,
 *   byService: [{ haircutType: string, count: number }]
 * }
 */
export const getAppointmentsSummaryHandler = asyncHandler(async (req: Request, res: Response) => {
  const { month, includeCanceled } = appointmentsSummaryQuerySchema.parse(req.query);

  const summary = await getMonthlyAppointmentsSummary({
    month,
    includeCanceled: includeCanceled ?? false,
  });

  res.json(summary);
});
