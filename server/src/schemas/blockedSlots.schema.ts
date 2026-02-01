import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data no formato YYYY-MM-DD');

const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM');

export const bulkBlockSlotsSchema = z.object({
  date: dateSchema,
  times: z.array(timeSchema).nonempty('Informe ao menos um horário'),
  reason: z.string().max(140).optional(),
});

export const bulkUnblockSlotsSchema = z.object({
  date: dateSchema,
  times: z.array(timeSchema).nonempty('Informe ao menos um horário'),
});

export type BulkBlockSlotsInput = z.infer<typeof bulkBlockSlotsSchema>;
export type BulkUnblockSlotsInput = z.infer<typeof bulkUnblockSlotsSchema>;
