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

export const listBlockedSlotsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query;
  const blockedSlots = await listBlockedSlots(typeof date === 'string' ? date : undefined);
  res.json(blockedSlots);
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
