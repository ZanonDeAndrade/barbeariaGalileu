import type { Request, Response } from 'express';
import {
  createBlockedSlot,
  listBlockedSlots,
  removeBlockedSlot,
  createBlockedSlotsBulk,
  deleteBlockedSlotsBulk,
} from '../services/blockedSlotService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { bulkBlockSlotsSchema, bulkUnblockSlotsSchema } from '../schemas/blockedSlots.schema.js';
import { performance } from 'perf_hooks';

export const listBlockedSlotsHandler = asyncHandler(async (req: Request, res: Response) => {
  const reqId = (req as any).requestId ?? 'no-reqid';
  const start = performance.now();
  const { date } = req.query;
  console.log(`[${reqId}] blockedSlots start`);

  const dateStr = typeof date === 'string' ? date : undefined;
  console.log(`[${reqId}] blockedSlots after-validate +${(performance.now() - start).toFixed(1)}ms`);

  const blockedSlots = await listBlockedSlots(dateStr);
  console.log(`[${reqId}] blockedSlots after-service +${(performance.now() - start).toFixed(1)}ms`);

  res.json(blockedSlots);
  console.log(`[${reqId}] blockedSlots before-response +${(performance.now() - start).toFixed(1)}ms`);
});

export const createBlockedSlotHandler = asyncHandler(async (req: Request, res: Response) => {
  const blockedSlot = await createBlockedSlot(req.body);
  res.status(201).json(blockedSlot);
});

export const removeBlockedSlotHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await removeBlockedSlot(id);
  res.status(204).send();
});

export const createBlockedSlotsBulkHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date, times, reason } = bulkBlockSlotsSchema.parse(req.body ?? {});
  const result = await createBlockedSlotsBulk({ date, times, reason });
  res.status(201).json(result);
});

export const deleteBlockedSlotsBulkHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date, times } = bulkUnblockSlotsSchema.parse(req.body ?? {});
  const result = await deleteBlockedSlotsBulk({ date, times });
  res.json(result);
});
