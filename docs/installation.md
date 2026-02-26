# Instalação

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- npm ou pnpm

## Instalação Rápida

### 1. Clone o Repositório

```bash
git clone https://github.com/your-org/keelo-api.git
cd keelo-api
```

### 2. Instale as Dependências

```bash
# Backend
npm install

# Frontend (Dashboard)
cd web && npm install && cd ..
```

### 3. Configure o Ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados
DATABASE_URL=postgresql://user:password@localhost:5432/keelo

# GitHub App
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# LLM Provider (escolha um)
ANTHROPIC_API_KEY=sk-ant-...
# ou
OPENAI_API_KEY=sk-...

# Slack (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Runtime (para exploração)
STAGING_USER=user@example.com
STAGING_PASS=password
```

### 4. Inicie o Banco de Dados

Com Docker:
```bash
docker-compose up -d postgres
```

Ou use um PostgreSQL existente e execute as migrações:
```bash
node scripts/migrate.js
```

### 5. Inicie o Servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

### 6. Inicie o Dashboard

```bash
cd web
npm run dev
```

Acesse: http://localhost:3001

## Docker (Recomendado para Produção)

```bash
# Build das imagens
docker-compose build

# Subir todos os serviços
docker-compose up -d
```

Serviços:
- API: http://localhost:3000
- Dashboard: http://localhost:3001
- PostgreSQL: localhost:5432

## Verificar Instalação

```bash
# Verificar se a API está rodando
curl http://localhost:3000/health

# Deve retornar:
# { "status": "ok", "database": "connected" }
```

## Próximos Passos

- [Configuração](./configuration.md) - Configure o Keelo
- [Primeiros Passos](./getting-started.md) - Rode sua primeira análise

