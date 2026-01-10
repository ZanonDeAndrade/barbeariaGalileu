import { z } from 'zod';

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Informe month no formato YYYY-MM');

const includeCanceledSchema = z
  .union([z.literal('true'), z.literal('false')])
  .optional()
  .transform((value) => value === 'true');

export const appointmentsSummaryQuerySchema = z.object({
  month: monthSchema,
  includeCanceled: includeCanceledSchema,
});

export type AppointmentsSummaryQuery = z.infer<typeof appointmentsSummaryQuerySchema>;

