import { z } from 'zod';
import { parseBrazilDateTimeToUtcDate } from '../utils/dateTime.js';
import { normalizePhone } from '../utils/phone.js';

function parseSchemaDateTime(value: string | Date, fieldName: 'startTime' | 'newStartTime') {
  try {
    return parseBrazilDateTimeToUtcDate(value, fieldName);
  } catch {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'Data/hora invalida',
        path: [fieldName],
      },
    ]);
  }
}

export const phoneSchema = z
  .string()
  .min(8, 'Telefone invalido')
  .transform<string>((value) => normalizePhone(value))
  .refine((value) => value.length >= 8, { message: 'Telefone invalido' });

export type CreateAppointmentInput = {
  customerName: string;
  customerPhone: string;
  haircutType: string;
  startTime: Date;
  notes?: string;
};

type RescheduleAppointmentBody = {
  phone: string;
  newStartTime: Date;
  reason?: string;
};

export const createAppointmentBodySchema = z.object({
  customerName: z.string().min(3, 'Informe o nome completo').transform((value) => value.trim()),
  customerPhone: phoneSchema,
  haircutType: z.string(),
  startTime: z
    .union([z.string(), z.date()])
    .transform<Date>((value) => parseSchemaDateTime(value, 'startTime')),
  notes: z.string().max(280).optional(),
});

export const cancelByCustomerBodySchema = z.object({
  phone: phoneSchema,
  reason: z.string().max(280).optional(),
});

export const rescheduleAppointmentBodySchema = z.object({
  phone: phoneSchema,
  newStartTime: z
    .union([z.string(), z.date()])
    .transform<Date>((value) => parseSchemaDateTime(value, 'newStartTime')),
  reason: z.string().max(280).optional(),
});

export const appointmentsByPhoneBodySchema = z.object({
  phone: phoneSchema,
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export type AppointmentsByPhoneInput = z.infer<typeof appointmentsByPhoneBodySchema>;
