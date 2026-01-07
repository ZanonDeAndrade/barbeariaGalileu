import { parseISO } from 'date-fns';
import { z } from 'zod';
import { normalizePhone } from '../utils/phone.js';

export const phoneSchema = z
  .string()
  .min(8, 'Telefone inválido')
  .transform((value) => normalizePhone(value))
  .refine((value) => value.length >= 8, { message: 'Telefone inválido' });

export const createAppointmentBodySchema = z.object({
  customerName: z.string().min(3, 'Informe o nome completo').transform((value) => value.trim()),
  customerPhone: phoneSchema,
  haircutType: z.string(),
  startTime: z.union([z.string(), z.date()]).transform((value) => {
    const parsed = value instanceof Date ? value : parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: 'Data/hora inválida',
          path: ['startTime'],
        },
      ]);
    }
    return parsed;
  }),
  notes: z.string().max(280).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentBodySchema>;

export const appointmentsByPhoneBodySchema = z.object({
  phone: phoneSchema,
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export type AppointmentsByPhoneInput = z.infer<typeof appointmentsByPhoneBodySchema>;
