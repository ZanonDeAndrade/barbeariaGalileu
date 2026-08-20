import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export function getMpClient() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN não configurado');
  }
  return new MercadoPagoConfig({ accessToken });
}

export type AppointmentDraft = {
  customerName: string;
  customerPhone: string;
  haircutType: string;
  startTime: string; // ISO
  notes?: string;
};

export async function createPixPayment(params: {
  amount: number;
  description: string;
  payer: { email: string; first_name?: string };
  appointment: AppointmentDraft;
  appointmentId: string;
}) {
  const client = getMpClient();
  const payment = new Payment(client);

  const body: any = {
    transaction_amount: params.amount,
    description: params.description,
    payment_method_id: 'pix',
    external_reference: params.appointmentId,
    payer: {
      email: params.payer.email,
      first_name: params.payer.first_name ?? 'Cliente',
    },
    metadata: {
      appointmentId: params.appointmentId,
      appointment: params.appointment,
    },
    notification_url: process.env.MP_WEBHOOK_URL || undefined,
  };

  const res = await payment.create({ body });
  return res;
}

/**
 * Campos do Payment Brick que o cliente pode enviar. Tudo que estiver fora
 * desta lista e descartado: o payload cru era espalhado no corpo da cobranca,
 * entao um `transaction_amount` (ou `metadata`, ou `external_reference`)
 * enviado pelo navegador sobrescrevia o valor calculado pelo servidor.
 */
const ALLOWED_CARD_PAYLOAD_FIELDS = [
  'token',
  'issuer_id',
  'payment_method_id',
  'payment_method_option_id',
  'processing_mode',
  'payer',
] as const;

export function pickAllowedCardPayload(cardPayload: Record<string, any>) {
  const picked: Record<string, any> = {};

  for (const field of ALLOWED_CARD_PAYLOAD_FIELDS) {
    if (cardPayload[field] !== undefined) {
      picked[field] = cardPayload[field];
    }
  }

  return picked;
}

export async function createCardPayment(params: {
  amount: number;
  description: string;
  appointment: AppointmentDraft;
  appointmentId: string;
  // Dados crus vindos do Payment Brick (token, method, issuer, payer...)
  cardPayload: Record<string, any>;
}) {
  const client = getMpClient();
  const payment = new Payment(client);

  const body: any = {
    ...pickAllowedCardPayload(params.cardPayload),
    // Campos controlados pelo servidor vem DEPOIS do spread, de proposito.
    transaction_amount: params.amount,
    description: params.description,
    // Garante pagamento a vista, mesmo que o Brick envie outro valor.
    installments: 1,
    external_reference: params.appointmentId,
    metadata: {
      appointmentId: params.appointmentId,
      appointment: params.appointment,
    },
    notification_url: process.env.MP_WEBHOOK_URL || undefined,
  };

  const res = await payment.create({ body });
  return res;
}

export async function getPaymentById(paymentId: string) {
  const client = getMpClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

export async function markAppointmentPayment(appointmentId: string, data: {
  method: 'cartao' | 'pix' | 'dinheiro';
  status: 'pending' | 'approved' | 'rejected';
  mpPaymentId?: string;
}, prismaClient: PrismaClient = prisma) {
  const appointment = await prismaClient.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    return;
  }

  const updateData: Prisma.AppointmentUpdateInput = {
    paymentMethod: data.method,
    paymentStatus: data.status,
    mpPaymentId: data.mpPaymentId,
  };

  if (appointment.status !== 'CANCELLED' && data.status === 'approved') {
    updateData.status = 'CONFIRMED';
  }

  await prismaClient.appointment.update({
    where: { id: appointmentId },
    data: updateData,
  });
}
