# Barbearia Galileu

Aplicação full-stack para agendamento de cortes de cabelo em uma barbearia, construída com React + TypeScript no frontend e ASP.NET Core 8 + Entity Framework Core (SQLite) no backend.

## Estrutura

- `customer-app/`: aplicação web para clientes realizarem agendamentos.
- `barber-app/`: painel separado para o barbeiro gerenciar agenda e bloqueios.
- `server/`: API REST em .NET para gerenciamento dos agendamentos, horários e bloqueios.
- `BarbeariaGalileu.sln`: solução para abrir o backend no Visual Studio/VS Code.

## Requisitos de alto nível

- Cliente
  - Escolhe tipo de corte, data, horário, informa nome e telefone.
  - Visualiza horários disponíveis com base em bloqueios e agendamentos existentes.
- Barbeiro
  - Visualiza agendamentos futuros com detalhes (cliente, telefone, tipo de corte).
  - Pode bloquear horários específicos para indisponibilidade.

## Setup resumido

1. Instalar dependências dos frontends (`customer-app/` e `barber-app/`) com `npm install`.
2. Restaurar o backend .NET:
   ```bash
   cd server
   DOTNET_CLI_HOME=$PWD/.dotnet dotnet restore
   ```
3. Rodar o backend com `DOTNET_CLI_HOME=$PWD/.dotnet dotnet run` (HTTP em `http://127.0.0.1:5000`, HTTPS em `https://127.0.0.1:7000`) e iniciar os frontends com `npm run dev` (`customer-app` usa a porta 5173 e `barber-app` a 5174).

## Backend (`server/`)

- API construída com ASP.NET Core 8 + Entity Framework Core (SQLite por padrão, basta ajustar a connection string para trocar de banco).
- Comandos úteis:
  - `dotnet run` — inicia a API em modo desenvolvimento.
  - `dotnet build` — compila o projeto.
  - `dotnet ef database update` — aplica migrations (se estiver utilizando migrations do EF).
- Endpoints principais:
  - `GET /api/haircuts` — lista serviços disponíveis.
  - `GET /api/appointments/availability?date=YYYY-MM-DD` — retorna horários e status.
  - `POST /api/appointments` — cria agendamento (nome, telefone, corte, horário).
  - `GET /api/appointments` — lista agendamentos futuros.
  - `GET /api/blocked-slots?date=YYYY-MM-DD` — bloqueios do dia.
  - `POST /api/blocked-slots` — bloqueia horário específico.
  - `DELETE /api/blocked-slots/:id` — remove bloqueio.

## Frontend Cliente (`customer-app/`)

- Criado com Vite + React 18 + TypeScript.
- Comandos úteis:
  - `npm run dev` — inicia Vite em modo desenvolvimento (porta 5173).
  - `npm run build` — gera build de produção.
  - `npm run preview` — serve build localmente.
- Variáveis de ambiente: definir `VITE_API_BASE_URL` (fallback padrão: `http://localhost:5000/api`).
- UI responsiva com paleta branco/cinza/preto focada no agendamento do cliente.

## Frontend Barbeiro (`barber-app/`)

- Mesmo stack (Vite + React 18 + TypeScript), mas separado para acesso restrito.
- Comandos úteis:
  - `npm run dev` — inicia Vite na porta 5174.
  - `npm run build` e `npm run preview` — equivalentes ao projeto do cliente.
- Ambiente: definir `VITE_API_BASE_URL` se quiser sobrescrever o fallback (padrão `http://localhost:5000/api`).
- Interface dedicada ao barbeiro para visualizar agendamentos, bloquear horários e remover bloqueios.

Detalhes adicionais estão documentados dentro de cada diretório.
