import { Request, Response } from 'express';
import { z } from 'zod';
import {
  AppointmentDraft,
  createCardPayment,
  createPixPayment,
  getPaymentById,
  markAppointmentPayment,
} from '../services/payments.service.js';
import { createAppointment } from '../services/appointmentService.js';
import { prisma } from '../config/prisma.js';
import { parseISO } from 'date-fns';

const appointmentDraftSchema = z.object({
  customerName: z.string().min(3),
  customerPhone: z.string().min(8),
  haircutType: z.string(),
  startTime: z.string(),
  notes: z.string().optional(),
});

export async function processCardPaymentHandler(req: Request, res: Response) {
  const schema = z.object({
    amount: z.number().positive(),
    description: z.string().default('Agendamento de serviço'),
    appointment: appointmentDraftSchema,
    cardPayload: z.record(z.any()),
  });

  type ProcessCardPaymentInput = {
    amount: number;
    description: string;
    appointment: AppointmentDraft;
    cardPayload: Record<string, any>;
  };

  const { amount, description, appointment, cardPayload } =
    schema.parse(req.body) as ProcessCardPaymentInput;

  const payment = await createCardPayment({ amount, description, appointment, cardPayload });

  const status = (payment as any).status as string;
  const paymentId = (payment as any).id?.toString();

  if (status === 'approved') {
    const appointmentToCreate = {
      ...appointment,
      startTime: new Date(appointment.startTime),
    };
    const created = await createAppointment(appointmentToCreate);
    await markAppointmentPayment(created.id, {
      method: 'cartao',
      status: 'approved',
      mpPaymentId: paymentId,
    });
    return res.json({ status, mpPaymentId: paymentId, appointmentId: created.id });
  }

  return res.json({ status, mpPaymentId: paymentId });
}

export async function createPixPaymentHandler(req: Request, res: Response) {
  const schema = z.object({
    amount: z.number().positive(),
    description: z.string().default('Agendamento de serviço'),
    payer: z.object({ email: z.string().email(), first_name: z.string().optional() }),
    appointment: appointmentDraftSchema,
  });

  type CreatePixPaymentInput = {
    amount: number;
    description: string;
    payer: { email: string; first_name?: string };
    appointment: AppointmentDraft;
  };

  const { amount, description, payer, appointment } =
    schema.parse(req.body) as CreatePixPaymentInput;

  const payment = await createPixPayment({ amount, description, payer, appointment });
  const paymentId = (payment as any).id?.toString();
  const poi = (payment as any).point_of_interaction?.transaction_data || {};

  return res.json({
    status: (payment as any).status,
    mpPaymentId: paymentId,
    qr_code: poi.qr_code,
    qr_code_base64: poi.qr_code_base64,
    ticket_url: poi.ticket_url,
  });
}

export async function createCashAppointmentHandler(req: Request, res: Response) {
  const appointment = appointmentDraftSchema.parse(req.body);
  const appointmentToCreate = {
    ...appointment,
    startTime: new Date(appointment.startTime),
  };
  const created = await createAppointment(appointmentToCreate);
  await markAppointmentPayment(created.id, { method: 'dinheiro', status: 'pending' });
  res.status(201).json({ appointmentId: created.id, status: 'pending' });
}

// Webhook de notificações do Mercado Pago
export async function paymentWebhookHandler(req: Request, res: Response) {
  try {
    const id =
      (req.body?.data && (req.body as any).data.id) ||
      (req.query && (req.query['data.id'] as string)) ||
      (req.body?.id as string);

    if (!id) {
      return res.status(400).json({ message: 'payment id ausente' });
    }

    const payment = await getPaymentById(id.toString());
    const status = (payment as any).status as string;
    const metadata = (payment as any).metadata || {};
    const methodId = (payment as any).payment_method_id as string | undefined;

    if (status === 'approved' && metadata?.appointment) {
      const appointment = metadata.appointment as AppointmentDraft;
      try {
        const appointmentToCreate = {
          ...appointment,
          startTime: new Date(appointment.startTime),
        };
        const created = await createAppointment(appointmentToCreate);
        await markAppointmentPayment(created.id, {
          method: methodId === 'pix' ? 'pix' : 'cartao',
          status: 'approved',
          mpPaymentId: (payment as any).id?.toString(),
        });
      } catch (err) {
        // Caso o horário já tenha sido confirmado por outra notificação, apenas atualiza pagamento
        const existing = await prisma.appointment.findFirst({
          where: { startTime: parseISO(appointment.startTime) },
        });
        if (existing) {
          await markAppointmentPayment(existing.id, {
            method: methodId === 'pix' ? 'pix' : 'cartao',
            status: 'approved',
            mpPaymentId: (payment as any).id?.toString(),
          });
        }
      }
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Webhook erro', error);
    return res.status(500).json({ message: 'Erro no webhook' });
  }
}

