import { z } from 'zod';

/**
 * O endpoint informado pelo navegador e usado pelo servidor para fazer um
 * POST (web-push). Para evitar SSRF, aceitamos apenas HTTPS para hosts
 * publicos com nome de dominio — nunca IPs literais ou nomes internos.
 */
export function isSafePushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return false;
  }
  // IPv6 literal ([::1]) ou IPv4 literal.
  if (url.hostname.startsWith('[')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  // Nome sem ponto (ex.: host interno de rede) nao e um servico de push real.
  if (!host.includes('.')) return false;

  return true;
}

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url('Endpoint invalido')
    .max(2048, 'Endpoint invalido')
    .refine(isSafePushEndpoint, 'Endpoint invalido'),
  keys: z.object({
    p256dh: z.string().min(1, 'Chave p256dh ausente'),
    auth: z.string().min(1, 'Chave auth ausente'),
  }),
});

export const subscribeCustomerBodySchema = z.object({
  phone: z.string().min(8, 'Telefone invalido'),
  subscription: pushSubscriptionSchema,
  userAgent: z.string().max(512).optional(),
});

export const subscribeBarberBodySchema = z.object({
  subscription: pushSubscriptionSchema,
  userAgent: z.string().max(512).optional(),
});

export const unsubscribeBodySchema = z.object({
  endpoint: z.string().url('Endpoint invalido'),
});

export const statusQuerySchema = z.object({
  endpoint: z.string().url('Endpoint invalido'),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
