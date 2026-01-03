import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createAppointment,
  cancelAppointment,
  getAvailability,
  listAppointments,
  listHaircuts,
} from '../services/appointmentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getHaircutsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const haircuts = await listHaircuts();
  res.json(haircuts);
});

export const getAvailabilityHandler = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query;
  const availability = await getAvailability(typeof date === 'string' ? date : undefined);
  res.json(availability);
});

export const createAppointmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await createAppointment(req.body);
  res.status(201).json(appointment);
});

export const listAppointmentsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const appointments = await listAppointments();
  res.json(appointments);
});

export const cancelAppointmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const paramsSchema = z.object({
    id: z.string().min(1),
  });

  const bodySchema = z.object({
    reason: z.string().max(280).optional(),
  });

  const { id } = paramsSchema.parse(req.params);
  const { reason } = bodySchema.parse(req.body ?? {});

  const appointment = await cancelAppointment(id, { reason });
  res.json(appointment);
});
