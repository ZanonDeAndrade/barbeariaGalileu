# Barbearia Galileu

Aplicação full-stack para agendamento de cortes de cabelo em uma barbearia, construída com React + TypeScript no frontend e Node.js + Express + TypeScript no backend. O backend utiliza Prisma ORM com banco SQLite por padrão, podendo ser adaptado para outros provedores.

## Estrutura

- `client/`: aplicação web para clientes e barbeiros.
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

1. Instalar dependências em `client/` e `server/` com `npm install`.
2. Em `server/`, configurar o arquivo `.env` (ver `.env.example`) e executar `npx prisma migrate dev`.
3. Rodar `npm run dev` em ambos os diretórios (backend porta 4000, frontend porta 5173 por padrão).

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

## Frontend (`client/`)

- Criado com Vite + React 18 + TypeScript.
- Comandos úteis:
  - `npm run dev` — inicia Vite em modo desenvolvimento (porta 5173).
  - `npm run build` — gera build de produção.
  - `npm run preview` — serve build localmente.
- Variáveis de ambiente: copiar `.env.example` para `.env` e ajustar `VITE_API_BASE_URL` se necessário.
- UI responsiva com paleta branco/cinza/preto, páginas:
  - `/` — fluxo do cliente.
  - `/barbeiro` — dashboard de agendamentos/bloqueios.

Detalhes adicionais estão documentados dentro de cada diretório.
