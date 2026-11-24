# ExtraAula — Plataforma EdTech de Mentoria e Reforço Acadêmico sob Demanda

MVP funcional de uma plataforma EdTech que combina:
- **Uber**: descoberta de professores disponíveis em tempo real com filtros de disciplina, nota e disponibilidade.
- **InDrive**: negociação livre de valores em tokens com propostas, contrapropostas e sugestão de horário.
- **Marketplace**: reputação mútua verificada (1–5 estrelas), perfil profissional e QR Code público direto.
- **EdTech**: reforço acadêmico (`Tira-dúvidas`: 15–30 min) e `Mentoria profissional` (30–60 min), com sala de atendimento em tempo real via WebSockets e cronômetro oficial controlado pelo servidor.

---

## Arquitetura & Stack Tecnológica

### Backend (`/backend`)
- **Python 3.12+** + **FastAPI** + **Uvicorn**
- **SQLAlchemy 2.0** (SQLite para execução local instantânea / PostgreSQL via Docker Compose)
- **Pydantic v2** + **Pydantic Settings** (`.env`)
- **Autenticação JWT** (`PyJWT`) + **Hash de senhas com `bcrypt`** + RBAC por perfil (`STUDENT`, `TEACHER`, `ADMIN`)
- **WebSockets nativos** (`/ws/sessions/{session_id}`) para chat em tempo real, indicador de presença e sincronização de cronômetro servidor-autoritativo
- **Swagger / OpenAPI** em `/docs` e `/redoc`

### Frontend (`/frontend`)
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + componentes estilo **Shadcn/UI** + **Lucide Icons**
- **Recharts** para gráficos operacionais no Dashboard Administrativo
- **qrcode.react** para geração de QR Codes públicos por professor

---

## Estrutura de Diretórios

```text
ExtraAula/
├── backend/
│   ├── app/
│   │   ├── core/          # config.py, database.py, security.py, state_machine.py, exceptions.py
│   │   ├── models/        # 14 entidades relacionais SQLAlchemy com índices e constraints
│   │   ├── schemas/       # DTOs Pydantic v2
│   │   ├── services/      # Regras de negócio: wallet_service, negotiation_service, session_service
│   │   ├── routers/       # auth, marketplace, subjects, teachers, requests, sessions, wallet, notifications, admin, ws
│   │   ├── seed.py        # Seed idempotente (1 admin, 5 professores, 15 alunos, 8 disciplinas, ...)
│   │   └── main.py        # Aplicação FastAPI + CORS + global exception handlers
│   ├── tests/
│   │   ├── test_business_rules.py   # Testes unitários (máquina de estados, escrow ACID, billing)
│   │   └── test_api_integration.py  # Testes de integração (auth, negociação, WebSocket, reviews, admin)
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/           # Cliente HTTP + URL WebSocket
│   │   ├── components/    # Primitivos UI, AppShell, RequestModal, TeacherQRCard
│   │   ├── contexts/      # AuthContext, ToastContext
│   │   ├── pages/         # Landing, Login, Register, Marketplace, PublicTeacher (QR), Requests, Sessions, SessionRoom, Wallet, TeacherDashboard, AdminDashboard
│   │   └── types/         # Tipagens TypeScript espelhadas com a API
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Credenciais de Demonstração (Seed)

O seed popula automaticamente **1 administrador, 5 professores, 15 alunos, 8 disciplinas**, solicitações em diferentes estados, contrapropostas pendentes, sessões concluídas/agendadas/canceladas, transações ACID e avaliações.

| Perfil | E-mail | Senha | Observação |
| --- | --- | --- | --- |
| **Administrador** | `admin@extraaula.com` | `Admin123!` | Acesso completo ao Dashboard Admin e gestão |
| **Aluno (Principal)** | `aluno1@extraaula.com` | `Aluno123!` | Lucas Andrade — possui contraproposta pendente + sessão agendada |
| **Alunos 2 a 15** | `aluno2@extraaula.com` .. `aluno15@extraaula.com` | `Aluno123!` | Perfis acadêmicos e carteiras populadas |
| **Profa. Ana Clara** | `prof.ana@extraaula.com` | `Prof123!` | Cálculo I & II, Estatística — QR `/t/ana-monteiro-calc` |
| **Prof. Carlos Lima** | `prof.carlos@extraaula.com` | `Prof123!` | Algoritmos, SQL, Eng. Software — QR `/t/carlos-lima-dev` |
| **Profa. Marina** | `prof.marina@extraaula.com` | `Prof123!` | Física Mecânica, Cálculo — QR `/t/marina-oliveira-fis` |
| **Prof. Rafael** | `prof.rafael@extraaula.com` | `Prof123!` | Eng. Software, Mentoria Carreira/TCC — QR `/t/rafael-vasconcelos-mentor` |
| **Profa. Juliana** | `prof.juliana@extraaula.com` | `Prof123!` | Química Geral, Estatística (Offline) — QR `/t/juliana-ferreira-quim` |

> Na tela de **Login** e na **Landing Page**, há botões de **Acesso Rápido (1 clique)** para demonstrar cada perfil instantaneamente.

---

## Como Executar Localmente

### 1. Backend (FastAPI + SQLite)

```bash
cd backend
# Crie o ambiente virtual (usando uv ou python 3.12+)
uv venv --python 3.12 .venv
# Instale dependências
uv pip install --python .venv/Scripts/python.exe -r requirements.txt
# Popule os dados de demonstração
.venv/Scripts/python.exe -m app.seed
# Inicie a API (http://localhost:8000 | Swagger: http://localhost:8000/docs)
.venv/Scripts/uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# Acesse http://localhost:5173
```

### 3. Execução com Docker Compose (PostgreSQL + Backend + Frontend)

```bash
cp .env.example .env
docker compose up --build
# Frontend: http://localhost:3000
# API + Swagger: http://localhost:8000/docs
```

---

## Deploy Gratuito em Produção (Arquitetura Separada)

O projeto está pré-configurado para publicação gratuita com **Frontend na Vercel**, **Backend (FastAPI + WebSockets) no Render** e **Banco PostgreSQL persistente no Neon ou Supabase**:

```text
[ Navegador / Mobile ]
        │
        ├── HTTPS ──► Frontend React/Vite (Vercel: https://extraaula.vercel.app)
        │                 └── vercel.json (SPA rewrite para /t/:qrSlug, /sessions/:id, etc.)
        │
        └── HTTPS + WSS ──► Backend FastAPI (Render: https://extraaula-api.onrender.com)
                                ├── render.yaml (Blueprint pronto + AUTO_SEED=true)
                                └── PostgreSQL (Neon / Supabase — conexão normalizada automaticamente)
```

### Passo 1 — Banco PostgreSQL gratuito (Neon ou Supabase)
1. Crie um banco gratuito em [neon.tech](https://neon.tech) (ou [supabase.com](https://supabase.com)).
2. Copie a string de conexão PostgreSQL (`postgresql://...`).

### Passo 2 — Backend no Render (`render.yaml`)
1. Acesse [render.com](https://render.com) → **New +** → **Blueprint** e conecte este repositório GitHub.
2. O Render lerá automaticamente o arquivo `render.yaml` na raiz do projeto.
3. No campo `DATABASE_URL`, cole a string do Neon/Supabase (ou use `sqlite:///./extraaula.db` para demo efêmera).
4. Ao finalizar o deploy, copie a URL da API (ex.: `https://extraaula-api.onrender.com`).
   - O seed de demonstração (`AUTO_SEED=true`) roda automaticamente no primeiro startup de forma idempotente!

### Passo 3 — Frontend na Vercel (`frontend/vercel.json`)
1. Acesse [vercel.com](https://vercel.com) → **Add New Project** → importe este repositório GitHub.
2. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Environment Variable**:
     - `VITE_API_URL` = `https://extraaula-api.onrender.com` *(o cliente deriva automaticamente `wss://extraaula-api.onrender.com` para WebSockets!)*
3. Clique em **Deploy**.
4. *(Opcional)* No Render, atualize `FRONTEND_BASE_URL` com a URL final da Vercel (ex.: `https://extraaula.vercel.app`) para que os links gerados no QR Code apontem para o domínio público. *(O CORS já aceita automaticamente `https://*.vercel.app` via `CORS_ORIGIN_REGEX`.)*

---

## Testes Automatizados

Execute toda a suíte de testes unitários e de integração do backend:

```bash
cd backend
.venv/Scripts/python.exe -m pytest -v
```

---

## Principais Endpoints da API

Consulte a documentação interativa completa em `http://localhost:8000/docs`.

- **Autenticação**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/password-recovery`, `POST /api/auth/password-reset`
- **Marketplace & QR Público**: `GET /api/marketplace/teachers`, `GET /api/marketplace/teachers/{id}`, `GET /api/marketplace/teachers/{id}/reviews`, `GET /api/marketplace/qr/{qr_slug}`
- **Disciplinas**: `GET /api/subjects`, `POST /api/subjects` (Admin), `PATCH /api/subjects/{id}` (Admin)
- **Área do Professor**: `GET /api/teachers/me/profile`, `PUT /api/teachers/me/profile`, `GET /api/teachers/me/earnings`, `GET /api/teachers/me/reviews`
- **Solicitações & Negociação InDrive**: `POST /api/requests`, `GET /api/requests`, `POST /api/requests/{id}/proposals`, `POST /api/proposals/{id}/accept`, `POST /api/proposals/{id}/reject`, `POST /api/requests/{id}/cancel`
- **Sessões, Chat & Avaliações**: `GET /api/sessions`, `GET /api/sessions/{id}`, `GET /api/sessions/{id}/timer`, `POST /api/sessions/{id}/start`, `POST /api/sessions/{id}/finish`, `POST /api/sessions/{id}/cancel`, `GET/POST /api/sessions/{id}/messages`, `POST /api/sessions/{id}/reviews`, `WS /ws/sessions/{id}?token=<jwt>`
- **Carteira de Tokens**: `GET /api/wallet`, `POST /api/wallet/topup`
- **Notificações**: `GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`
- **Dashboard Admin**: `GET /api/admin/overview`, `GET /api/admin/users`, `PATCH /api/admin/users/{id}/toggle-active`, `GET /api/admin/teachers`, `GET /api/admin/sessions`, `GET /api/admin/transactions`

---

## Regras de Negócio & Segurança Implementadas

- **Máquina de Estados Centralizada** (`app/core/state_machine.py`): `CRIADA → PROPOSTA_ENVIADA → ACEITA → AGENDADA → EM_ANDAMENTO → FINALIZADA` + `RECUSADA`, `CANCELADA`, `EXPIRADA`. Transições inválidas são bloqueadas com HTTP `409`.
- **Proteções Financeiras ACID** (`app/services/wallet_service.py`):
  - `CheckConstraint` no banco (`balance >= 0`, `locked_balance >= 0`) e validação no serviço contra saldo negativo.
  - Chaves de idempotência (`idempotency_key` única) contra recargas, bloqueios e liquidações duplicadas.
  - Bloqueio em garantia (*escrow*) ao aceitar proposta, liquidação baseada no tempo oficial do backend (com comissão de 15% + estorno automático de eventual saldo não utilizado) e estorno integral em caso de cancelamento.
- **Cronômetro Oficial no Servidor**: o cliente não envia tempo nem valor cobrado; o backend calcula a duração real (`ended_at - started_at`) e transmite ticks via WebSocket.
- **Avaliações Protegidas**: permitidas apenas após status `FINALIZADA` e limitadas a uma avaliação por participante (`UniqueConstraint(session_id, reviewer_id)`), recalculando a média de reputação automaticamente.

## Limitações Conhecidas (Escopo fora do MVP)
- Tokens são 100% fictícios, sem integração real com Stripe Connect, Pagar.me ou Mercado Pago.
- Recuperação de senha exibe o token de demonstração em vez de enviar e-mail SMTP real.
- Sem chamadas de vídeo, sincronização com Google Calendar / Microsoft Graph ou app mobile nativo (arquitetura preparada para evoluções futuras).
