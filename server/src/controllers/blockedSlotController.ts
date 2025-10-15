import type { Request, Response } from 'express';
import {
  createBlockedSlot,
  listBlockedSlots,
  removeBlockedSlot,
} from '../services/blockedSlotService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
