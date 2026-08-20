import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  AppointmentDraft,
  createCardPayment,
  createPixPayment,
  markAppointmentPayment,
} from '../services/payments.service.js';
import { createAppointment } from '../services/appointmentService.js';
import { getHaircutById } from '../services/haircutService.js';
import { notifyNewAppointment } from '../services/appointmentNotificationService.js';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';

const appointmentDraftSchema = z.object({
  customerName: z.string().min(3).max(120),
  customerPhone: z.string().min(8).max(20),
  haircutType: z.string().max(60),
  startTime: z.string().max(40),
  notes: z.string().max(280).optional(),
});

/**
 * O valor cobrado NUNCA vem do cliente: ele e derivado do catalogo de servicos
 * no servidor. Antes, `amount` e `description` vinham do corpo da requisicao,
 * o que permitia a qualquer pessoa pagar R$0,01 por qualquer servico apenas
 * alterando o payload antes de enviar.
 */
export function resolvePriceForHaircut(haircutType: string) {
  const haircut = getHaircutById(haircutType);

  if (!haircut) {
    throw new HttpError(400, 'Tipo de corte invalido', { code: 'INVALID_HAIRCUT' });
  }

  return {
    amount: haircut.priceCents / 100,
    description: haircut.name,
  };
}

export async function processCardPaymentHandler(req: Request, res: Response) {
  const schema = z.object({
    // amount/description sao aceitos por compatibilidade com clientes antigos,
    // mas ignorados: o preco vem do catalogo do servidor.
    amount: z.number().positive().optional(),
    description: z.string().max(140).optional(),
    appointment: appointmentDraftSchema,
    cardPayload: z.record(z.any()),
  });

  type ProcessCardPaymentInput = {
    appointment: AppointmentDraft;
    cardPayload: Record<string, any>;
  };

  const { appointment, cardPayload } = schema.parse(req.body) as ProcessCardPaymentInput;
  const { amount, description } = resolvePriceForHaircut(appointment.haircutType);

  const appointmentToCreate = {
    ...appointment,
    startTime: appointment.startTime,
  };

  const created = await createAppointment(appointmentToCreate);
  await markAppointmentPayment(created.id, { method: 'cartao', status: 'pending' });

  let payment: unknown;
  try {
    payment = await createCardPayment({
      amount,
      description,
      appointment,
      appointmentId: created.id,
      cardPayload,
    });
  } catch (error) {
    await prisma.appointment.delete({ where: { id: created.id } }).catch(() => undefined);
    throw error;
  }

  const paymentId = (payment as any).id?.toString();
  const mpStatus = (payment as any).status as string | undefined;

  const normalizedStatus =
    mpStatus === 'approved'
      ? 'approved'
      : mpStatus === 'rejected' ||
          mpStatus === 'cancelled' ||
          mpStatus === 'refunded' ||
          mpStatus === 'charged_back'
        ? 'rejected'
        : 'pending';

  if (normalizedStatus === 'rejected') {
    await prisma.appointment.delete({ where: { id: created.id } }).catch(() => undefined);
    return res.json({ status: mpStatus, mpPaymentId: paymentId });
  }

  await markAppointmentPayment(created.id, {
    method: 'cartao',
    status: normalizedStatus,
    mpPaymentId: paymentId,
  });

  // Agendamento confirmado (cartao aprovado/pendente): notifica barbeiro e cliente.
  void notifyNewAppointment(created);

  return res.json({ status: mpStatus, mpPaymentId: paymentId, appointmentId: created.id });
}

export async function createPixPaymentHandler(req: Request, res: Response) {
  const schema = z.object({
    // Ver comentario em processCardPaymentHandler: preco e sempre do servidor.
    amount: z.number().positive().optional(),
    description: z.string().max(140).optional(),
    payer: z.object({ email: z.string().email(), first_name: z.string().max(80).optional() }),
    appointment: appointmentDraftSchema,
  });

  type CreatePixPaymentInput = {
    payer: { email: string; first_name?: string };
    appointment: AppointmentDraft;
  };

  const { payer, appointment } = schema.parse(req.body) as CreatePixPaymentInput;
  const { amount, description } = resolvePriceForHaircut(appointment.haircutType);

  const appointmentToCreate = {
    ...appointment,
    startTime: appointment.startTime,
  };

  const created = await createAppointment(appointmentToCreate);
  await markAppointmentPayment(created.id, { method: 'pix', status: 'pending' });

  let payment: unknown;
  try {
    payment = await createPixPayment({
      amount,
      description,
      payer,
      appointment,
      appointmentId: created.id,
    });
  } catch (error) {
    await prisma.appointment.delete({ where: { id: created.id } }).catch(() => undefined);
    throw error;
  }

  const paymentId = (payment as any).id?.toString();
  const mpStatus = (payment as any).status as string | undefined;
  const poi = (payment as any).point_of_interaction?.transaction_data || {};

  const normalizedStatus =
    mpStatus === 'approved'
      ? 'approved'
      : mpStatus === 'rejected'
        ? 'rejected'
        : 'pending';

  await markAppointmentPayment(created.id, {
    method: 'pix',
    status: normalizedStatus,
    mpPaymentId: paymentId,
  });

  // Agendamento reservado (PIX gerado): notifica barbeiro e cliente.
  void notifyNewAppointment(created);

  return res.json({
    status: mpStatus,
    mpPaymentId: paymentId,
    appointmentId: created.id,
    qr_code: poi.qr_code,
    qr_code_base64: poi.qr_code_base64,
    ticket_url: poi.ticket_url,
  });
}

export async function createCashAppointmentHandler(req: Request, res: Response) {
  const appointment = appointmentDraftSchema.parse(req.body) as AppointmentDraft;
  const appointmentToCreate = {
    ...appointment,
    startTime: appointment.startTime,
  };
  const created = await createAppointment(appointmentToCreate);
  await markAppointmentPayment(created.id, { method: 'dinheiro', status: 'pending' });

  // Agendamento em dinheiro: notifica barbeiro e cliente.
  void notifyNewAppointment(created);

  res.status(201).json({ appointmentId: created.id, status: 'pending' });
}
