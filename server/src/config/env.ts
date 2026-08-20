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
];

/**
 * Recomendadas, porem NAO bloqueantes: a ausencia gera warning no startup, nao
 * derruba o processo.
 *
 * MP_WEBHOOK_SECRET esta aqui temporariamente, por decisao explicita, para nao
 * atrasar a publicacao da correcao de autorizacao das rotas. Enquanto estiver
 * ausente, o webhook opera sem validacao criptografica de assinatura — que e
 * exatamente o comportamento que ja existia em producao antes desta mudanca,
 * entao nao ha regressao de seguranca. Ver PENDENCIA-SEGURANCA.md.
 */
export const PRODUCTION_RECOMMENDED_ENV: RequiredEnv[] = [
  {
    name: 'MP_WEBHOOK_SECRET',
    reason: 'validacao criptografica da assinatura do webhook do Mercado Pago',
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

/**
 * Avisos de configuracao que NAO bloqueiam o startup. Retorna os nomes das
 * variaveis recomendadas ausentes (nunca os valores).
 */
export function getMissingRecommendedEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isProduction(env)) {
    return [];
  }

  return PRODUCTION_RECOMMENDED_ENV.filter((item) => isBlank(env[item.name])).map(
    (item) => item.name,
  );
}

/** Emite os avisos de configuracao no startup. Nunca imprime valores. */
export function warnMissingRecommendedEnv(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Console, 'warn'> = console,
) {
  for (const name of getMissingRecommendedEnv(env)) {
    if (name === 'MP_WEBHOOK_SECRET') {
      logger.warn(
        '[config] MP_WEBHOOK_SECRET nao configurado. Validacao criptografica de ' +
          'assinatura do webhook do Mercado Pago desabilitada temporariamente.',
      );
    } else {
      logger.warn(`[config] variavel recomendada ausente: ${name}`);
    }
  }
}

/** Le uma variavel obrigatoria. Nunca ecoa o valor na mensagem de erro. */
export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
