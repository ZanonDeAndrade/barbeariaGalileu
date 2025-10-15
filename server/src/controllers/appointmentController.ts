import type { Request, Response } from 'express';
import {
  createAppointment,
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
