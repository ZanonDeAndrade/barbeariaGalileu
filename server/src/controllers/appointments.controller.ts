import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  appointmentsByPhoneBodySchema,
  cancelByCustomerBodySchema,
  rescheduleAppointmentBodySchema,
} from '../schemas/appointments.schema.js';
import {
  cancelAppointment,
  cancelAppointmentByCustomer,
  createAppointment,
  getAvailability,
  listAppointments,
  listAppointmentsByPhone,
  listCustomerAppointments,
  listHaircuts,
  rescheduleAppointmentByCustomer,
} from '../services/appointmentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { performance } from 'perf_hooks';

export const getHaircutsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const reqId = (_req as any).requestId ?? 'no-reqid';
  const start = performance.now();
  console.log(`[${reqId}] haircuts start`);

  const haircuts = await listHaircuts();
  console.log(`[${reqId}] haircuts after-service +${(performance.now() - start).toFixed(1)}ms`);

  res.json(haircuts);
  console.log(`[${reqId}] haircuts before-response +${(performance.now() - start).toFixed(1)}ms`);
});

export const getAvailabilityHandler = asyncHandler(async (req: Request, res: Response) => {
  const reqId = (req as any).requestId ?? 'no-reqid';
  const start = performance.now();
  const { date } = req.query;
  console.log(`[${reqId}] availability start`);

  const parsedDate = typeof date === 'string' ? date : undefined;
  console.log(`[${reqId}] availability after-validate +${(performance.now() - start).toFixed(1)}ms`);

  const availability = await getAvailability(parsedDate);
  console.log(`[${reqId}] availability after-service +${(performance.now() - start).toFixed(1)}ms`);

  res.json(availability);
  console.log(`[${reqId}] availability before-response +${(performance.now() - start).toFixed(1)}ms`);
});

export const createAppointmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const appointment = await createAppointment(req.body);

  const appointments = appointment.customerId
    ? await listCustomerAppointments(appointment.customerId)
    : [];

  res.status(201).json({
    appointmentId: appointment.id,
    appointments,
  });
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

export const cancelAppointmentByCustomerHandler = asyncHandler(async (req: Request, res: Response) => {
  const paramsSchema = z.object({
    id: z.string().min(1),
  });

  const { id } = paramsSchema.parse(req.params);
  const { phone, reason } = cancelByCustomerBodySchema.parse(req.body ?? {});

  const appointment = await cancelAppointmentByCustomer(id, { phone, reason });
  res.json(appointment);
});

export const rescheduleAppointmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const paramsSchema = z.object({
    id: z.string().min(1),
  });

  const { id } = paramsSchema.parse(req.params);
  const { phone, newStartTime, reason } = rescheduleAppointmentBodySchema.parse(req.body ?? {});

  const result = await rescheduleAppointmentByCustomer(id, { phone, newStartTime, reason });
  res.json(result);
});

export const listAppointmentsByPhoneHandler = asyncHandler(async (req: Request, res: Response) => {
  const { phone, limit } = appointmentsByPhoneBodySchema.parse(req.body ?? {});

  const customerAppointments = await listAppointmentsByPhone(phone, { limit });
  res.json({ appointments: customerAppointments });
});
