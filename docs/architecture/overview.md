# Arquitetura - Visão Geral

O Keelo é um sistema de QA autônomo composto por múltiplos módulos.

## Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  KEELO                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ENTRADAS                           PROCESSAMENTO                          │
│   ─────────                          ─────────────                          │
│                                                                              │
│   ┌─────────┐     ┌─────────┐      ┌──────────────────────┐                │
│   │ GitHub  │────▶│ Webhook │─────▶│                      │                │
│   │ (PRs)   │     └─────────┘      │     ORCHESTRATOR     │                │
│   └─────────┘                      │     ─────────────    │                │
│                                    │                      │                │
│   ┌─────────┐     ┌─────────┐      │  • Roteia eventos    │                │
│   │Dashboard│────▶│   API   │─────▶│  • Gerencia fluxo    │                │
│   │ (Web)   │     └─────────┘      │  • Coordena módulos  │                │
│   └─────────┘                      │                      │                │
│                                    └──────────┬───────────┘                │
│                                               │                             │
│         ┌─────────────────────────────────────┼─────────────────────────────┤
│         │                                     │                             │
│         ▼                                     ▼                             │
│   ┌───────────────┐                    ┌───────────────┐                   │
│   │   ANALYZER    │                    │ TEST GENERATOR│                   │
│   │   ──────────  │                    │ ─────────────  │                   │
│   │               │                    │               │                   │
│   │ • Riscos      │                    │ • Playwright  │                   │
│   │ • Cenários    │                    │ • Vitest      │                   │
│   │ • Coverage    │                    │ • Valida      │                   │
│   │ • Dependências│                    │               │                   │
│   └───────────────┘                    └───────────────┘                   │
│         │                                     │                             │
│         └──────────────────┬──────────────────┘                            │
│                            │                                                │
│                            ▼                                                │
│                    ┌───────────────┐                                       │
│                    │     LLM       │                                       │
│                    │   ─────────   │                                       │
│                    │               │                                       │
│                    │ • Anthropic   │                                       │
│                    │ • OpenAI      │                                       │
│                    └───────────────┘                                       │
│                                                                             │
│   SAÍDAS                             ARMAZENAMENTO                         │
│   ──────                             ────────────                          │
│                                                                             │
│   ┌─────────┐     ┌─────────┐      ┌───────────────┐                       │
│   │ GitHub  │◀────│  PR     │      │  PostgreSQL   │                       │
│   │ Comment │     │ Creator │      │  ───────────  │                       │
│   └─────────┘     └─────────┘      │               │                       │
│                                    │ • Análises    │                       │
│   ┌─────────┐     ┌─────────┐      │ • Cenários    │                       │
│   │ Slack   │◀────│ Notifier│      │ • Hot Spots   │                       │
│   └─────────┘     └─────────┘      │ • Settings    │                       │
│                                    └───────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Módulos Principais

### Core

| Módulo | Responsabilidade |
|--------|-----------------|
| `orchestrator.ts` | Coordena fluxo entre módulos |
| `analyzer.ts` | Analisa código e detecta riscos |
| `test-generator.ts` | Gera testes automatizados |
| `llm.ts` | Interface com LLM providers |
| `formatter.ts` | Formata output para GitHub |

### Database

| Módulo | Responsabilidade |
|--------|-----------------|
| `connection.ts` | Pool de conexões PostgreSQL |
| `analysis-repository.ts` | CRUD de análises |
| `settings-repository.ts` | Configurações via banco |
| `hotspots-repository.ts` | Hot spots de risco |
| `qa-metrics-repository.ts` | Métricas de QA |

### Integrations

| Módulo | Responsabilidade |
|--------|-----------------|
| `github/client.ts` | API do GitHub |
| `github/pr-creator.ts` | Cria PRs de teste |
| `slack/client.ts` | Notificações Slack |

### Runtime

| Módulo | Responsabilidade |
|--------|-----------------|
| `smart-agent.ts` | Agente de navegação |
| `code-analyzer.ts` | Análise de código (Code-Aware) |
| `dom-analyzer.ts` | Análise de DOM |
| `page-understanding.ts` | Entendimento de páginas |
| `session-manager.ts` | Contexto de sessão |

### API

| Módulo | Responsabilidade |
|--------|-----------------|
| `server.ts` | Express server |
| `routes/` | Endpoints REST |
| `websocket.ts` | Real-time updates |

### Config

| Módulo | Responsabilidade |
|--------|-----------------|
| `env.ts` | Variáveis de ambiente |
| `keelo-config.ts` | Configurações do Keelo |
| `logger.ts` | Logging com Pino |

## Fluxo de Dados

### Análise de PR

```
1. GitHub envia webhook (PR opened)
   │
2. ▼ server.ts recebe e valida
   │
3. ▼ orchestrator.ts roteia para analyzer
   │
4. ▼ analyzer.ts extrai diff e contexto
   │
5. ▼ llm.ts envia para Claude/GPT
   │
6. ▼ formatter.ts formata resposta
   │
7. ▼ github/client.ts comenta no PR
   │
8. ▼ analysis-repository.ts salva histórico
```

### Runtime Explorer

```
1. Scheduler dispara às 3h (ou manual)
   │
2. ▼ smart-agent.ts inicializa
   │
3. ▼ code-analyzer.ts analisa código (se Code-Aware)
   │
4. ▼ Playwright abre browser
   │
5. ▼ Loop de exploração:
   │   ├── dom-analyzer.ts analisa página
   │   ├── page-understanding.ts entende contexto
   │   ├── llm.ts decide ação
   │   └── Executa ação
   │
6. ▼ Salva bugs encontrados
   │
7. ▼ slack/client.ts notifica
```

## Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js + TypeScript |
| API | Express |
| Database | PostgreSQL |
| ORM | pg (raw SQL) |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Browser | Playwright |
| LLM | Anthropic Claude / OpenAI GPT |
| Logging | Pino |
| Scheduler | node-cron |

## Próximos Passos

- [Backend](./backend.md)
- [Frontend](./frontend.md)
- [Runtime Agent](./runtime-agent.md)

