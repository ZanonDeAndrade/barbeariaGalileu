/**
 * Validacao central das variaveis de ambiente obrigatorias.
 *
 * Objetivo: falhar no startup, e nao quando a primeira requisicao chegar. Uma
 * variavel ausente descoberta em runtime vira 500 intermitente ou — pior —
 * degradacao silenciosa de um controle de seguranca.
 *
 * Regra: NUNCA imprimir o valor de um segredo. Apenas o nome da variavel.
 */

export type RequiredEnv = {
  name: string;
  reason: string;
};

/**
 * Obrigatorias apenas em producao. Em desenvolvimento e nos testes o servidor
 * continua subindo sem elas (o codigo degrada de forma explicita: push
 * responde 503, webhook em dev apenas avisa).
 */
export const PRODUCTION_REQUIRED_ENV: RequiredEnv[] = [
  { name: 'DATABASE_URL', reason: 'conexao com o PostgreSQL' },
  { name: 'DIRECT_URL', reason: 'conexao direta usada pelo Prisma' },
  {
    name: 'BARBER_API_KEY',
    reason: 'unica credencial da area do barbeiro (requireBarber e fail-closed sem ela)',
  },
  { name: 'MP_ACCESS_TOKEN', reason: 'API do Mercado Pago' },
  {
    name: 'MP_WEBHOOK_SECRET',
    reason: 'validacao da assinatura do webhook do Mercado Pago',
  },
];

export function isProduction(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production';
}

function isBlank(value: string | undefined) {
  return !value || value.trim().length === 0;
}

/** Retorna os NOMES das variaveis obrigatorias ausentes. Nunca os valores. */
export function getMissingProductionEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) {
    return [];
  }

  return PRODUCTION_REQUIRED_ENV.filter((item) => isBlank(env[item.name])).map(
    (item) => item.name,
  );
}

/**
 * Lanca quando falta variavel obrigatoria em producao. Chamado no startup
 * (src/index.ts), antes de abrir a porta.
 */
export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  const missing = getMissingProductionEnv(env);

  if (missing.length === 0) {
    return;
  }

  const details = PRODUCTION_REQUIRED_ENV.filter((item) => missing.includes(item.name))
    .map((item) => `  - ${item.name}: ${item.reason}`)
    .join('\n');

  throw new Error(
    `Variaveis de ambiente obrigatorias ausentes em producao:\n${details}\n` +
      'Configure-as no ambiente de execucao antes de iniciar o servidor.',
  );
}

/** Le uma variavel obrigatoria. Nunca ecoa o valor na mensagem de erro. */
export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
