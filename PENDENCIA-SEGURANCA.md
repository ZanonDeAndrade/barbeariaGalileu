# Pendências de segurança

## ABERTA — Validação criptográfica do webhook do Mercado Pago

**Ação:** configurar `MP_WEBHOOK_SECRET` em produção.

**Severidade:** MÉDIA. **Não é uma regressão** — é a formalização de uma lacuna
que já existia. Nenhuma revisão do Cloud Run (00012→00019) jamais teve essa
variável, e o código anterior montava o webhook sem middleware algum
(`router.post('/mercadopago', mercadoPagoWebhookHandler)`). O endpoint nunca
validou assinatura.

**Estado atual:** o código de validação (`verifyMercadoPagoSignature`) está
implementado e testado, mas só entra em ação quando `MP_WEBHOOK_SECRET` existe.
Sem a variável, o servidor sobe emitindo um warning e o webhook segue no
comportamento antigo.

**Por que isso não bloqueou o deploy da correção de autorização:** a exposição
de PII em `/api/appointments` era CRÍTICA e estava ativa; a lacuna do webhook é
média e já existia. Tratá-las juntas atrasaria a correção crítica.

**O que sustenta a segurança enquanto a pendência estiver aberta:**

- o corpo do POST não é fonte de verdade — o handler reconsulta o pagamento na
  API oficial do Mercado Pago (`fetchPayment`) e deriva status, método e valor
  da resposta do provedor;
- do corpo só se extrai o ID a consultar;
- idempotência preservada via tabela `WebhookEvent` (unique em
  `provider + relatedProviderPaymentId + eventAction`);
- nenhuma ação privilegiada é executada apenas com base em campos do POST.

**Risco residual:** um atacante pode forçar re-sincronizações de pagamentos
reais (sem conseguir forjar status) e sondar a existência de IDs de pagamento.
Abuso de recurso e enumeração — não manipulação financeira.

**Como fechar:**

1. Mercado Pago → Suas integrações → aplicação de produção → Webhooks →
   revelar e **copiar** a assinatura secreta. **Não usar o botão de regenerar**,
   que rotacionaria o segredo.
2. Criar o secret sem deixar o valor no histórico do shell:

   ```
   read -rs -p "Assinatura secreta MP: " S && printf %s "$S" \
     | gcloud secrets create mp-webhook-secret \
         --project=faroledu --replication-policy=automatic --data-file=- && unset S
   ```

   Use `printf %s`, nunca `echo`: o `\n` extra corromperia o HMAC e faria todo
   webhook legítimo ser rejeitado.
3. Permissão mínima, apenas neste secret:

   ```
   gcloud secrets add-iam-policy-binding mp-webhook-secret --project=faroledu \
     --member=serviceAccount:219675169776-compute@developer.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   ```
4. Ligar ao serviço (incremental, preserva as demais variáveis):

   ```
   gcloud run services update barbearia-galileu \
     --project=faroledu --region=southamerica-east1 \
     --update-secrets=MP_WEBHOOK_SECRET=mp-webhook-secret:latest
   ```

Nenhuma alteração de código é necessária: basta a variável existir para a
validação passar a ser obrigatória. Considere depois promovê-la de
`PRODUCTION_RECOMMENDED_ENV` para `PRODUCTION_REQUIRED_ENV` em
`server/src/config/env.ts` (o teste que trava essa decisão vai falhar de
propósito, forçando a leitura deste documento).

---

## ABERTAS — não bloqueantes, herdadas da auditoria

| Item | Severidade | Nota |
|---|---|---|
| Telefone como identidade do cliente | ALTA | Exige OTP; muda o fluxo do cliente |
| Service account do Cloud Run com `roles/editor` project-wide | MÉDIA | Over-privilégio pré-existente; reduzir para papéis mínimos |
| Race condition em serviços multi-slot | MÉDIA | Índice único cobre só o slot inicial; exige migration |
| Rate limit em memória por instância | BAIXA | Ideal: Redis ou Cloud Armor |
| `mercadopago` 2.10.0 (major 3.x pendente) | BAIXA | Advisory transitivo de `uuid`, não aplicável ao uso atual |
| Sem script de lint nos 3 pacotes | INFO | — |
| Painel sem UI para sync manual de pagamento | INFO | Relevante se o webhook falhar |
