import type { Appointment } from '@prisma/client';
import { format } from 'date-fns';
import type { HaircutOption } from '../types/haircut.js';

interface MessagingConfig {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
}

let memoizedConfig: MessagingConfig | null = null;

function resolveMessagingConfig(): MessagingConfig | null {
  if (!memoizedConfig) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v18.0';

    if (!token || !phoneNumberId) {
      return null;
    }

    memoizedConfig = {
      token,
      phoneNumberId,
      apiVersion: apiVersion.replace(/^\//, ''),
    };
  }

  return memoizedConfig;
}

function formatPriceBRL(priceCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(priceCents / 100);
}

function sanitizePhoneNumber(raw: string): string | null {
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) {
    return null;
  }

  if (digitsOnly.startsWith('55')) {
    return digitsOnly;
  }

  // Accept numbers with local format (10 or 11 digits). Normalize to Brazil (+55).
  if (digitsOnly.length === 10 || digitsOnly.length === 11) {
    return `55${digitsOnly}`;
  }

  // Already includes a country code different from 55.
  if (digitsOnly.length > 11) {
    return digitsOnly;
  }

  return null;
}

function buildMessageBody(appointment: Appointment, haircut: HaircutOption) {
  const scheduledDate = format(appointment.startTime, 'dd/MM/yyyy');
  const scheduledTime = format(appointment.startTime, 'HH:mm');
  const value = formatPriceBRL(haircut.priceCents);

  return [
    `Olá ${appointment.customerName}!`,
    `Seu agendamento para ${haircut.name} está confirmado.`,
    `Data: ${scheduledDate}`,
    `Horário: ${scheduledTime}`,
    `Valor: ${value}`,
    '',
    'Qualquer dúvida, estamos à disposição.',
    'Barbearia Galileu',
  ].join('\n');
}

async function sendWhatsappTextMessage(config: MessagingConfig, to: string, body: string) {
  const fetchFn = globalThis.fetch?.bind(globalThis);
  if (!fetchFn) {
    console.warn(
      '[notifyAppointmentConfirmation] Ambiente não oferece fetch global. Atualize para Node 18+ ou instale um polyfill.',
    );
    return;
  }

  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          body,
          preview_url: false,
        },
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => null);
      console.error(
        '[notifyAppointmentConfirmation] Falha ao enviar mensagem no WhatsApp Cloud API.',
        response.status,
        errorPayload,
      );
    }
  } catch (error) {
    console.error('[notifyAppointmentConfirmation] Erro inesperado ao chamar WhatsApp Cloud API.', error);
  }
}

export async function notifyAppointmentConfirmation(
  appointment: Appointment,
  haircut: HaircutOption,
) {
  const sanitizedPhone = sanitizePhoneNumber(appointment.customerPhone);
  const config = resolveMessagingConfig();

  if (!config || !sanitizedPhone) {
    if (!config) {
      console.warn(
        '[notifyAppointmentConfirmation] Mensageria não configurada. Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.',
      );
    } else {
      console.warn(
        `[notifyAppointmentConfirmation] Telefone do cliente inválido: "${appointment.customerPhone}".`,
      );
    }
    return;
  }

  const messageBody = buildMessageBody(appointment, haircut);
  await sendWhatsappTextMessage(config, sanitizedPhone, messageBody);
}
