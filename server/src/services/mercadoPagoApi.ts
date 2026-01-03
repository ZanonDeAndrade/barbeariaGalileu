import { z } from 'zod';

const baseUrl = (process.env.MP_API_BASE_URL ?? 'https://api.mercadopago.com').replace(/\/$/, '');

function getAccessToken() {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN não configurado');
  }
  return accessToken;
}

async function mpGet(path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[Mercado Pago] GET ${path} falhou: ${res.status} ${res.statusText} - ${text}`);
  }

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`[Mercado Pago] Resposta inválida em JSON: ${String(error)}`);
  }
}

const mpPaymentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => value.toString()),
  status: z.string(),
  status_detail: z.string().optional().nullable(),
  metadata: z.unknown().optional().nullable(),
  external_reference: z.string().optional().nullable(),
  payment_method_id: z.string().optional().nullable(),
});

export type MercadoPagoPayment = z.infer<typeof mpPaymentSchema>;

export async function fetchMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const data = await mpGet(`/v1/payments/${encodeURIComponent(paymentId)}`);
  return mpPaymentSchema.parse(data);
}

const mpMerchantOrderSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((value) => value.toString()),
    payments: z
      .array(
        z.object({
          id: z.union([z.string(), z.number()]).transform((value) => value.toString()),
          status: z.string().optional().nullable(),
        }),
      )
      .optional()
      .nullable(),
  })
  .transform((data) => ({
    id: data.id,
    payments: data.payments ?? [],
  }));

export type MercadoPagoMerchantOrder = z.infer<typeof mpMerchantOrderSchema>;

export async function fetchMercadoPagoMerchantOrder(orderId: string): Promise<MercadoPagoMerchantOrder> {
  const data = await mpGet(`/merchant_orders/${encodeURIComponent(orderId)}`);
  return mpMerchantOrderSchema.parse(data);
}
