# Barbearia Galileu

Aplicação full-stack para agendamento de cortes de cabelo em uma barbearia, construída com React + TypeScript no frontend e Node.js + Express + TypeScript no backend. O backend utiliza Prisma ORM com banco SQLite por padrão, podendo ser adaptado para outros provedores.

## Estrutura

- `customer-app/`: aplicação web para clientes realizarem agendamentos.
- `barber-app/`: painel separado para o barbeiro gerenciar agenda e bloqueios.
- `server/`: API REST para gerenciamento dos agendamentos, horários e bloqueios.
- `index.ts`: placeholder original (não utilizado).

## Requisitos de alto nível

- Cliente
  - Escolhe tipo de corte, data, horário, informa nome e telefone.
  - Visualiza horários disponíveis com base em bloqueios e agendamentos existentes.
- Barbeiro
  - Visualiza agendamentos futuros com detalhes (cliente, telefone, tipo de corte).
  - Pode bloquear horários específicos para indisponibilidade.

## Setup resumido

1. Instalar dependências em `server/`, `customer-app/` e `barber-app/` com `npm install`.
2. Em `server/`, configurar o arquivo `.env` (ver `.env.example`) e executar `npx prisma migrate dev`.
3. Rodar `npm run dev` em cada frontend (cliente na porta 5173, barbeiro na porta 5174) e `npm run dev` no backend (porta 4000).

## Backend (`server/`)

- API construída com Express + Prisma (SQLite por default).
- Comandos úteis:
  - `npm run dev` — inicia API em modo desenvolvimento via `ts-node-dev`.
  - `npm run build` / `npm start` — gera JS compilado e executa em produção.
  - `npm run prisma:migrate` — executa migrations (atalho para `prisma migrate dev`).
  - `npm run prisma:generate` — atualiza client Prisma.
- Endpoints principais:
  - `GET /api/haircuts` — lista serviços disponíveis.
  - `GET /api/appointments/availability?date=YYYY-MM-DD` — retorna horários e status.
  - `POST /api/appointments` — cria agendamento (nome, telefone, corte, horário).
  - `GET /api/appointments` — lista agendamentos futuros.
  - `GET /api/blocked-slots?date=YYYY-MM-DD` — bloqueios do dia.
  - `POST /api/blocked-slots` — bloqueia horário específico.
  - `DELETE /api/blocked-slots/:id` — remove bloqueio.
  - `POST /api/barber/blocked-slots/bulk` — bloqueia vários horários de uma data (payload: `{ date, times: ["08:00",...], reason? }`) — protegido por `x-barber-api-key` quando `BARBER_API_KEY` estiver definido.
  - `DELETE /api/barber/blocked-slots/bulk` — remove bloqueios em lote (payload: `{ date, times: [...] }`) — protegido por `x-barber-api-key`.
- Variáveis de ambiente:
  - `DATABASE_URL` — conexão do Prisma (SQLite local por padrão).
  - `ALLOWED_ORIGINS` — lista de origens separadas por vírgula autorizadas no CORS.
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` (opcional) — credenciais da WhatsApp Cloud API (Meta) usadas para enviar as confirmações de agendamento.

## Frontend Cliente (`customer-app/`)

- Criado com Vite + React 18 + TypeScript.
- Comandos úteis:
  - `npm run dev` — inicia Vite em modo desenvolvimento (porta 5173).
  - `npm run build` — gera build de produção.
  - `npm run preview` — serve build localmente.
- Variáveis de ambiente: copiar `.env.example` para `.env` e ajustar `VITE_API_BASE_URL` se necessário.
- UI responsiva com paleta branco/cinza/preto focada no agendamento do cliente.

## Frontend Barbeiro (`barber-app/`)

- Mesmo stack (Vite + React 18 + TypeScript), mas separado para acesso restrito.
- Comandos úteis:
  - `npm run dev` — inicia Vite na porta 5174.
  - `npm run build` e `npm run preview` — equivalentes ao projeto do cliente.
- Ambiente: copiar `.env.example` para `.env` e configurar `VITE_API_BASE_URL`.
- Interface dedicada ao barbeiro para visualizar agendamentos, bloquear horários e remover bloqueios.

Detalhes adicionais estão documentados dentro de cada diretório.
