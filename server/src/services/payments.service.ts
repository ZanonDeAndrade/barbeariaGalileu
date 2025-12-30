import { MercadoPagoConfig, Payment } from 'mercadopago';
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

export async function createCardPayment(params: {
  amount: number;
  description: string;
  appointment: AppointmentDraft;
  // Dados crus vindos do Payment Brick (token, method, issuer, installments, payer...)
  cardPayload: Record<string, any>;
}) {
  const client = getMpClient();
  const payment = new Payment(client);

  const body: any = {
    transaction_amount: params.amount,
    description: params.description,
    ...params.cardPayload,
    metadata: {
      appointment: params.appointment,
    },
    notification_url: process.env.MP_WEBHOOK_URL || undefined,
  };

  // Garante pagamento à vista, mesmo que o Brick envie outro valor
  body.installments = 1;

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
}) {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      paymentMethod: data.method,
      paymentStatus: data.status,
      mpPaymentId: data.mpPaymentId,
    },
  });
}
