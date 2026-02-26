# 🤖 Keelo - Agente Autônomo de QA

Keelo é um revisor de Pull Requests com IA que analisa automaticamente mudanças de código e fornece insights profissionais de QA diretamente nos PRs do GitHub.

![Keelo Banner](https://via.placeholder.com/800x200/1a1a2e/16f5b0?text=Keelo+-+Agente+Autônomo+de+QA)

## ✨ Funcionalidades

### 💬 Comandos Slash (Modo Sob Demanda)

O Keelo funciona via comandos em comentários de PR:

| Comando | Descrição |
|---------|-----------|
| `/keelo analyze` | Analisa o PR e identifica riscos, cenários de teste e gaps |
| `/keelo generate tests` | Gera testes automatizados e cria PR com os testes |
| `/keelo help` | Mostra a lista de comandos disponíveis |

**Como usar:**

1. Abra um PR no GitHub
2. Comente `/keelo analyze` para obter a análise
3. Após revisar, comente `/keelo generate tests` para gerar os testes

> **Nota:** A análise automática está desabilitada. O Keelo só atua quando você invocar um comando.

### 🔍 Fase 1: Consistência da Análise
- **Relatórios Profissionais de QA** - Análise estruturada e repetível com formato consistente
- **Avaliação de Risco** - Categorização Crítico, Alto, Médio, Baixo
- **Taxonomia de Cenários** - Happy path, Sad path, Edge cases, Boundary, Segurança
- **Heurísticas de QA** - Partição de equivalência, Análise de valor limite, Transição de estados
- **Suporte Multi-idioma** - Inglês e Português (pt-br)

### 🛠️ Fase 2: Suporte ao Ciclo da Squad
- **Geração Automática de Testes** - Cria testes baseados nas mudanças do PR
- **Criação de Issues** - Abre issues no GitHub para gaps detectados
- **Gestão de Tasks** - Cria tasks para cobertura de testes
- **Critérios de Aceite** - Sugere critérios no formato Gherkin

### 🚀 Fase 3: Execução Autônoma
- **Geração de Código de Teste** - Testes completos Playwright/Cypress/Jest/Vitest
- **Operações Git** - Cria branches, commits, pushes
- **Criação de PR** - Abre PRs com os testes gerados
- **Monitoramento de CI** - Acompanha falhas de CI
- **Relatório de Falhas** - Reporta problemas de CI no PR original

### 📢 Notificações
- **Integração com Slack** - Notificações em tempo real para análises, PRs e falhas

### 📊 Análise de Cobertura (Novo!)
- **Detecção Automática** - Encontra relatórios de cobertura (lcov, istanbul, clover)
- **Sugestões Inteligentes** - Recomenda testes para código não coberto
- **Métricas Visuais** - Exibe cobertura de linhas, branches e funções

### 🧠 Aprendizado Contínuo (Novo!)
- **Coleta de Feedback** - Reações dos usuários (👍 👎 ❤️ 🚀 😕)
- **Histórico de Análises** - Armazena resultados para aprendizado
- **Melhoria de Prompts** - Ajusta análises com base no feedback
- **Estatísticas** - Dashboard de utilidade das análises

### 🎯 Análise Pré-Implementação (Novo!)
- **Análise de Figma** - Analisa designs via imagem ou URL
- **Análise de Requisitos** - Processa histórias de usuário e critérios de aceite
- **Parsing de PDF** - Extrai requisitos de documentos PDF
- **Cenários Antecipados** - Gera cenários de teste ANTES do desenvolvimento

### 🗄️ Histórico de Análises (Novo!)
- **Banco de Dados** - PostgreSQL para armazenar todas as análises
- **Histórico Completo** - Consulte análises anteriores de PRs e requisitos
- **Estatísticas** - Dashboard com métricas de qualidade
- **Docker** - Fácil deploy com docker-compose

### 🖥️ Interface Gráfica (Novo!)
- **Dashboard** - Visão geral em tempo real das análises
- **Autenticação Okta** - Login seguro com Okta Verify
- **WebSocket** - Atualizações em tempo real
- **Análise de Requisitos** - Interface para upload de Figma, PDFs e histórias

---

## 📁 Estrutura do Projeto

```
keelo-api/
├── src/
│   ├── api/              # Servidor HTTP e rotas
│   │   ├── server.ts     # Aplicação Express
│   │   └── index.ts      # Exports da API
│   │
│   ├── config/           # Gerenciamento de configuração
│   │   ├── env.ts        # Variáveis de ambiente (.env)
│   │   ├── keelo-config.ts # Config do Keelo (.keelo.json)
│   │   ├── logger.ts     # Configuração do Pino
│   │   └── index.ts      # Exports de config
│   │
│   ├── core/             # Lógica de negócio
│   │   ├── analyzer.ts   # Análise de PR com LLM
│   │   ├── formatter.ts  # Formatador de comentários Markdown
│   │   ├── llm.ts        # Abstração OpenAI/Anthropic
│   │   ├── orchestrator.ts # Coordenador principal do fluxo
│   │   ├── test-generator.ts # Geração de código de teste
│   │   ├── autonomous-executor.ts # Modo autônomo
│   │   ├── types.ts      # Tipos TypeScript
│   │   └── index.ts      # Exports do core
│   │
│   ├── integrations/     # Integrações com serviços externos
│   │   ├── github/       # Integração com GitHub API
│   │   │   ├── client.ts # Cliente Octokit e webhooks
│   │   │   ├── git-operations.ts # Branch, commit, push
│   │   │   ├── pr-creator.ts # Criação de PR e monitoramento de CI
│   │   │   ├── issue-creator.ts # Criação de issues e tasks
│   │   │   ├── pattern-detector.ts # Detecção de padrões de teste
│   │   │   └── index.ts  # Exports do GitHub
│   │   │
│   │   ├── slack/        # Integração com Slack
│   │   │   ├── client.ts # Notificações via webhook
│   │   │   └── index.ts  # Exports do Slack
│   │   │
│   │   └── index.ts      # Exports de integrações
│   │
│   ├── main.ts           # Ponto de entrada da aplicação
│   └── index.ts          # Exports da biblioteca
│
├── prompts/              # Templates de prompts para LLM
│   ├── system.en.md      # Prompt de sistema em inglês
│   ├── system.pt-br.md   # Prompt de sistema em português
│   ├── user.en.md        # Prompt de usuário em inglês
│   ├── user.pt-br.md     # Prompt de usuário em português
│   ├── test-generator.en.md
│   ├── test-generator.pt-br.md
│   ├── test-pom.en.md
│   └── test-pom.pt-br.md
│
├── .keelo.json           # Configuração do Keelo
├── .keelo.example.json   # Exemplo de configuração
├── .env.example          # Template de variáveis de ambiente
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

---

## 🚀 Início Rápido

### 1. Clone e Instale

```bash
git clone https://github.com/your-org/keelo-api.git
cd keelo-api
npm install
```

### 2. Configure o Ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# GitHub App (obrigatório)
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=seu-webhook-secret

# Provedor LLM (pelo menos um obrigatório)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...

# Servidor
PORT=3000
LOG_LEVEL=info
```

### 3. Configure o Keelo

```bash
cp .keelo.example.json .keelo.json
```

Edite o `.keelo.json`:

```json
{
  "language": "pt-br",
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "testFrameworks": {
    "e2e": "playwright",
    "unit": "vitest",
    "api": "supertest"
  },
  "actions": {
    "autoCreateIssues": false,
    "autoGenerateTests": true,
    "createDraftPRs": false,
    "autonomous": {
      "enabled": true,
      "createPR": true,
      "monitorCI": true
    }
  },
  "notifications": {
    "slack": {
      "enabled": true,
      "webhookUrl": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
      "notifyOn": {
        "analysis": true,
        "testPRCreated": true,
        "ciFailure": true,
        "criticalRisk": true
      }
    }
  },
  "testOutputDir": "e2e"
}
```

### 4. Execute o Servidor

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Produção
npm run build
npm start
```

### 5. Exponha com ngrok (para desenvolvimento)

```bash
ngrok http 3000
```

---

## 🔧 Configuração do GitHub App

### Permissões Necessárias

| Permissão | Acesso | Propósito |
|-----------|--------|-----------|
| Pull requests | Leitura e Escrita | Ler detalhes do PR, postar comentários |
| Issues | Leitura e Escrita | Criar issues e tasks |
| Issue comments | Leitura e Escrita | Ler comandos em comentários, responder |
| Contents | Leitura e Escrita | Ler arquivos, criar branches, commits |
| Metadata | Leitura | Metadados do repositório |
| Checks | Leitura | Monitorar status do CI |

### Inscrever-se em Eventos

- ✅ Issue comment (para comandos `/keelo`)
- ⚠️ Pull request (apenas para referência - análise automática está desabilitada)

### Configuração do Webhook

- **URL:** `https://seu-dominio.com/webhook`
- **Content type:** `application/json`
- **Secret:** Mesmo valor de `GITHUB_WEBHOOK_SECRET`

---

## 📖 Referência de Configuração

### Opções do `.keelo.json`

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `language` | `"en"` \| `"pt-br"` | `"en"` | Idioma de saída |
| `trigger` | `"auto"` \| `"command"` | `"auto"` | Modo de ativação: `auto` = análise automática em PRs, `command` = apenas via `/keelo` comandos |
| `llm.provider` | `"openai"` \| `"anthropic"` | `"anthropic"` | Provedor LLM |
| `llm.model` | `string` | Padrão do provedor | Modelo específico |
| `llm.temperature` | `number` | `0.2` | Aleatoriedade da resposta |
| `llm.maxTokens` | `number` | `4000` | Máximo de tokens na resposta |
| `testFrameworks.e2e` | `"playwright"` \| `"cypress"` | `"playwright"` | Framework E2E |
| `testFrameworks.unit` | `"jest"` \| `"vitest"` | `"vitest"` | Framework de testes unitários |
| `actions.autoGenerateTests` | `boolean` | `false` | Gerar testes automaticamente |
| `actions.autoCreateIssues` | `boolean` | `false` | Criar issues automaticamente |
| `actions.createDraftPRs` | `boolean` | `true` | Criar PRs como rascunho |
| `actions.autonomous.enabled` | `boolean` | `false` | Habilitar modo autônomo |
| `notifications.slack.enabled` | `boolean` | `false` | Habilitar Slack |
| `coverage.enabled` | `boolean` | `true` | Habilitar análise de cobertura |
| `coverage.minThreshold` | `number` | `80` | Threshold mínimo de cobertura (%) |
| `coverage.suggestTests` | `boolean` | `true` | Sugerir testes para áreas não cobertas |
| `feedback.enabled` | `boolean` | `true` | Habilitar coleta de feedback |
| `feedback.useLearning` | `boolean` | `true` | Usar feedback para melhorar análises |
| `feedback.showStats` | `boolean` | `false` | Mostrar estatísticas no comentário |
| `testOutputDir` | `string` | `"tests/generated"` | Diretório de saída dos testes |

---

## 🐳 Docker

### Build

```bash
docker build -t keelo .
```

### Executar

```bash
docker run -d \
  -p 3000:3000 \
  -e GITHUB_APP_ID=123456 \
  -e GITHUB_PRIVATE_KEY="..." \
  -e GITHUB_WEBHOOK_SECRET="..." \
  -e ANTHROPIC_API_KEY="sk-ant-api03-..." \
  -v $(pwd)/.keelo.json:/app/.keelo.json \
  keelo
```

---

## 📊 Endpoints da API

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/health` | Health check com informações do serviço |
| POST | `/webhook` | Receptor de webhooks do GitHub |

### Resposta do Health

```json
{
  "status": "ok",
  "service": "keelo",
  "version": "1.0.0",
  "language": "pt-br",
  "llmProvider": "anthropic"
}
```

---

## 🔌 Integrações

### Slack

1. Crie um Slack App em https://api.slack.com/apps
2. Habilite **Incoming Webhooks**
3. Adicione webhook a um canal
4. Copie a URL do webhook para o `.keelo.json`

### Anthropic (Claude)

1. Obtenha a API key em https://console.anthropic.com/settings/keys
2. Adicione ao `.env` como `ANTHROPIC_API_KEY`
3. Formato da chave: `sk-ant-api03-...`

### OpenAI

1. Obtenha a API key em https://platform.openai.com/api-keys
2. Adicione ao `.env` como `OPENAI_API_KEY`
3. Formato da chave: `sk-...`

---

## 🧪 Detecção de Padrões de Teste

O Keelo detecta automaticamente sua estrutura de testes existente:

| Padrão | Detecção |
|--------|----------|
| Playwright | `playwright.config.ts`, `@playwright/test` |
| Cypress | `cypress.config.ts`, `cypress/` |
| Jest | `jest.config.ts`, `jest` |
| Vitest | `vitest.config.ts`, `vitest` |

### Estrutura POM (padrão se não existirem testes)

```
e2e/
├── tests/     # Arquivos de teste
├── pages/     # Page Objects
├── utils/     # Funções utilitárias
└── fixtures/  # Fixtures de teste
```

---

---

## 📊 Como Funciona a Análise de Cobertura

O Keelo detecta automaticamente relatórios de cobertura no repositório:

| Formato | Arquivos Detectados |
|---------|---------------------|
| LCOV | `coverage/lcov.info` |
| Istanbul | `coverage/coverage-final.json` |
| Clover | `coverage/clover.xml` |

### Exemplo de Saída

```
### 📊 Análise de Cobertura

| Métrica | Cobertura |
|---------|-----------|
| Linhas | 🟢 85.2% |
| Branches | 🟡 72.4% |
| Funções | 🟢 90.1% |

#### 💡 Sugestões de Cobertura

- 🔴 **src/utils/parser.ts**: Apenas 45.2% das linhas estão cobertas
- 🟡 **src/services/api.ts**: 3 função(ões) sem cobertura de teste
```

---

## 🧠 Como Funciona o Aprendizado Contínuo

O Keelo aprende com o feedback dos usuários para melhorar suas análises:

### Fluxo de Aprendizado

```
1. Análise do PR → 2. Usuário reage → 3. Keelo coleta → 4. Ajusta prompts
         ↑                                                        │
         └────────────────────────────────────────────────────────┘
```

### Tipos de Feedback

| Reação | Significado |
|--------|-------------|
| 👍 | Análise útil e precisa |
| 👎 | Análise imprecisa |
| ❤️ | Cenários de teste valiosos |
| 🚀 | Excelente identificação de riscos |
| 😕 | Algo confuso ou incorreto |

### Dados Armazenados

Os dados de feedback são armazenados localmente em `.keelo-data/`:

```
.keelo-data/
├── feedback-history.json    # Histórico de reações
└── learning-insights.json   # Insights de aprendizado
```

---

---

## 🎯 Análise Pré-Implementação

O Keelo pode gerar cenários de teste **ANTES** do desenvolvimento, analisando:

### Endpoints Disponíveis

| Endpoint | Descrição |
|----------|-----------|
| `POST /analyze/requirements` | Análise completa (Figma + texto + PDF) |
| `POST /analyze/figma` | Análise apenas de design |
| `POST /analyze/user-story` | Análise de história de usuário |
| `GET /api` | Documentação da API |

### Exemplo: Análise Completa

```bash
curl -X POST http://localhost:3000/analyze/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Como um usuário, quero fazer login com email e senha para acessar minha conta",
    "figmaImage": "data:image/png;base64,...",
    "metadata": {
      "projectName": "E-commerce",
      "featureName": "Login",
      "sprint": "Sprint 10",
      "priority": "high"
    },
    "format": "json"
  }'
```

### Exemplo: História de Usuário

```bash
curl -X POST http://localhost:3000/analyze/user-story \
  -H "Content-Type: application/json" \
  -d '{
    "story": "Como um cliente, quero adicionar produtos ao carrinho para comprar depois",
    "acceptanceCriteria": "- Botão de adicionar visível\n- Quantidade editável\n- Atualização do badge",
    "context": "App de e-commerce mobile"
  }'
```

### Resposta da Análise

```json
{
  "success": true,
  "data": {
    "summary": {
      "title": "Funcionalidade de Carrinho",
      "description": "...",
      "complexity": "medium"
    },
    "scenarios": [
      {
        "id": "TC001",
        "title": "Adicionar produto ao carrinho",
        "category": "happy_path",
        "priority": "high",
        "steps": ["..."],
        "expectedResult": "...",
        "suggestedTestType": "e2e",
        "effort": "low"
      }
    ],
    "acceptanceCriteria": [
      {
        "id": "AC001",
        "description": "...",
        "gherkin": {
          "given": "...",
          "when": "...",
          "then": "..."
        },
        "automatable": true
      }
    ],
    "gaps": [...],
    "risks": [...],
    "uiAnalysis": {...}
  }
}
```

### Fontes de Requisitos

| Fonte | Campo | Descrição |
|-------|-------|-----------|
| Figma (imagem) | `figmaImage` | Base64 da imagem do design |
| Figma (URL) | `figmaUrl` | URL do arquivo Figma |
| Texto | `requirements` | História de usuário, requisitos, etc. |
| PDF | `pdfBase64` | Documento PDF em base64 |

> **Nota:** Pelo menos uma fonte deve ser fornecida.

### Análise de UI (Figma)

Quando uma imagem de design é fornecida, o Keelo analisa:

- **Componentes** - Botões, inputs, forms, modais, etc.
- **Estados** - Default, hover, disabled, error, loading
- **Fluxos** - Navegação e interações
- **Acessibilidade** - Problemas WCAG (A, AA, AAA)
- **Validações** - Campos obrigatórios, formatos, limites

### Parsing de PDF

Para melhor suporte a PDF, instale:

```bash
npm install pdf-parse
```

O Keelo extrai automaticamente:
- Texto do documento
- Histórias de usuário
- Critérios de aceite
- Seções e títulos

---

## 🗄️ Banco de Dados e Histórico

O Keelo pode armazenar todas as análises em um banco PostgreSQL para consulta posterior.

### Configuração com Docker

```bash
# Iniciar PostgreSQL e Keelo
docker-compose up -d

# Iniciar apenas o PostgreSQL (para desenvolvimento local)
docker-compose up -d postgres

# Iniciar com Adminer (admin UI)
docker-compose --profile admin up -d
```

### Variáveis de Ambiente

Adicione ao `.env`:

```env
# Database (opcional - habilita histórico)
DATABASE_URL=postgresql://keelo:keelo@localhost:5432/keelo
```

### Endpoints de Histórico

| Endpoint | Descrição |
|----------|-----------|
| `GET /history` | Lista análises com filtros |
| `GET /history/stats` | Estatísticas gerais |
| `GET /history/:id` | Detalhes de uma análise |
| `GET /history/:id/details` | Análise completa com cenários |
| `GET /history/repository/:owner/:repo` | Histórico de um repositório |

### Exemplos

```bash
# Listar análises de PR
curl "http://localhost:3000/history?type=pr&limit=10"

# Estatísticas
curl "http://localhost:3000/history/stats"

# Histórico de um repositório
curl "http://localhost:3000/history/repository/owner/repo"

# Filtrar por risco
curl "http://localhost:3000/history?risk=critical"
```

### Schema do Banco

O banco armazena:

- **analyses** - Todas as análises (PRs e requisitos)
- **test_scenarios** - Cenários de teste gerados
- **risks** - Riscos identificados
- **gaps** - Gaps nos requisitos
- **acceptance_criteria** - Critérios de aceite
- **feedback_entries** - Feedback dos usuários
- **generated_tests** - Testes gerados automaticamente

### Docker Compose

O `docker-compose.yml` inclui:

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `keelo` | 3000 | API principal |
| `postgres` | 5432 | Banco de dados |
| `adminer` | 8080 | Admin UI (opcional) |

---

## 🖥️ Interface Gráfica (Web)

O Keelo inclui uma interface gráfica moderna com autenticação Okta.

### Executando Localmente

```bash
# Instalar dependências do frontend
cd web && npm install

# Iniciar em desenvolvimento
npm run dev
```

Acesse: http://localhost:5173

### Autenticação Okta

Configure as variáveis de ambiente no `web/.env`:

```env
VITE_OKTA_ISSUER=https://your-domain.okta.com/oauth2/default
VITE_OKTA_CLIENT_ID=your-client-id
VITE_OKTA_REDIRECT_URI=http://localhost:5173/callback
```

#### Configuração no Okta

1. Acesse o Okta Admin Console
2. Vá em **Applications > Create App Integration**
3. Selecione **OIDC - OpenID Connect** e **Single-Page Application**
4. Configure:
   - **Sign-in redirect URIs**: `http://localhost:5173/callback`
   - **Sign-out redirect URIs**: `http://localhost:5173`
   - **Allowed grant types**: Authorization Code, Refresh Token
5. Copie o **Client ID** e configure no `.env`

### Modo Demo

Se Okta não estiver configurado, a aplicação funciona em modo demo com login automático.

### Docker Compose

```bash
# Subir tudo (API + Web + PostgreSQL)
docker-compose up -d

# Acessar
# - Web: http://localhost:5173
# - API: http://localhost:3000
# - Adminer: http://localhost:8080 (opcional)
```

### Funcionalidades da Interface

| Página | Descrição |
|--------|-----------|
| **Dashboard** | Visão geral com estatísticas e análises recentes |
| **Análises** | Lista completa com filtros e busca |
| **Requisitos** | Upload de Figma, PDF e histórias de usuário |
| **Configurações** | Status do sistema e configurações |

### WebSocket Real-time

A interface se conecta automaticamente via WebSocket para receber:

- Novas análises em tempo real
- Atualizações de status
- Notificações de riscos críticos

## 📝 Licença

MIT © Keelo Team
