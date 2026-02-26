# Estrutura de Pastas

```
keelo-api/
├── docs/                      # 📚 Documentação
│   ├── README.md
│   ├── installation.md
│   ├── configuration.md
│   ├── getting-started.md
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── runtime-agent.md
│   │   └── code-aware.md
│   ├── features/
│   │   ├── pr-analysis.md
│   │   ├── requirements-analysis.md
│   │   ├── test-generation.md
│   │   ├── runtime-explorer.md
│   │   └── dashboard.md
│   ├── integrations/
│   │   ├── github.md
│   │   ├── slack.md
│   │   └── llm.md
│   ├── reference/
│   │   ├── commands.md
│   │   ├── api.md
│   │   └── keelo-config.md
│   └── development/
│       ├── contributing.md
│       ├── folder-structure.md
│       └── migrations.md
│
├── src/                       # 🔧 Código fonte (Backend)
│   ├── main.ts               # Entrypoint
│   ├── index.ts              # Exports públicos
│   │
│   ├── api/                  # 🌐 API REST
│   │   ├── server.ts         # Express app
│   │   ├── websocket.ts      # WebSocket
│   │   ├── index.ts
│   │   └── routes/
│   │       ├── history.ts    # /history endpoints
│   │       ├── qa-health.ts  # /qa-health endpoints
│   │       ├── runtime.ts    # /runtime endpoints
│   │       └── settings.ts   # /settings endpoints
│   │
│   ├── config/               # ⚙️ Configuração
│   │   ├── env.ts            # Variáveis de ambiente
│   │   ├── keelo-config.ts   # Configuração do Keelo
│   │   ├── logger.ts         # Pino logger
│   │   └── index.ts
│   │
│   ├── core/                 # 🧠 Lógica de negócio
│   │   ├── analyzer.ts       # Análise de PRs
│   │   ├── orchestrator.ts   # Coordenação
│   │   ├── llm.ts            # Interface com LLM
│   │   ├── formatter.ts      # Formatação de output
│   │   ├── test-generator.ts # Geração de testes
│   │   ├── test-validator.ts # Validação de sintaxe
│   │   ├── coverage-analyzer.ts
│   │   ├── dependency-analyzer.ts
│   │   ├── requirements-analyzer.ts
│   │   ├── autonomous-executor.ts
│   │   ├── ci-fixer.ts       # Auto-fix de CI
│   │   ├── command-parser.ts # /keelo commands
│   │   ├── feedback-collector.ts
│   │   ├── pdf-parser.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── database/             # 💾 Banco de dados
│   │   ├── connection.ts     # Pool PostgreSQL
│   │   ├── index.ts
│   │   └── repositories/
│   │       ├── analysis-repository.ts
│   │       ├── settings-repository.ts
│   │       ├── hotspots-repository.ts
│   │       └── qa-metrics-repository.ts
│   │
│   ├── integrations/         # 🔌 Integrações externas
│   │   ├── index.ts
│   │   ├── github/
│   │   │   ├── client.ts     # API GitHub
│   │   │   ├── pr-creator.ts # Criar PRs
│   │   │   ├── issue-creator.ts
│   │   │   └── index.ts
│   │   └── slack/
│   │       ├── client.ts     # Notificações
│   │       └── index.ts
│   │
│   └── runtime/              # 🤖 Runtime Explorer
│       ├── config.ts
│       ├── explorer.ts       # Explorador (v1)
│       ├── scheduler.ts      # Agendamento
│       ├── reporter.ts       # Relatórios
│       ├── index.ts
│       └── agent/            # Smart Agent (v2)
│           ├── smart-agent.ts
│           ├── code-analyzer.ts
│           ├── dom-analyzer.ts
│           ├── page-understanding.ts
│           ├── session-manager.ts
│           ├── smart-prompts.ts
│           ├── prompts.ts
│           ├── browser-agent.ts
│           ├── types.ts
│           └── index.ts
│
├── web/                      # 🖥️ Frontend (Dashboard)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Requirements.tsx
│   │   │   ├── AnalysisDetail.tsx
│   │   │   ├── QAHealth.tsx
│   │   │   ├── Runtime.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   └── ...
│   │   ├── stores/
│   │   │   ├── api.ts
│   │   │   └── realtime.ts
│   │   └── auth/
│   │       ├── AuthProvider.tsx
│   │       └── config.ts
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── database/                 # 📊 Migrações SQL
│   ├── init.sql
│   └── migrations/
│       ├── 001_add_risk_hotspots.sql
│       ├── 002_add_runtime_tables.sql
│       └── 003_add_settings_table.sql
│
├── prompts/                  # 📝 Prompts do LLM
│   ├── system.en.md
│   ├── system.pt-br.md
│   ├── user.en.md
│   ├── user.pt-br.md
│   ├── test-generator.en.md
│   └── test-generator.pt-br.md
│
├── scripts/                  # 🛠️ Scripts utilitários
│   ├── migrate.js            # Rodar migrações
│   ├── run-agent.ts          # Executar agente v1
│   ├── run-smart-agent.ts    # Executar agente v2
│   └── test-explorer.ts      # Testes do explorer
│
├── screenshots/              # 📸 Screenshots do Runtime
│
├── dist/                     # 📦 Build (gerado)
│
├── .env                      # 🔐 Variáveis (não versionado)
├── .env.example              # 📋 Template de variáveis
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## Convenções

### Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Arquivos | kebab-case | `code-analyzer.ts` |
| Classes | PascalCase | `SmartBrowserAgent` |
| Funções | camelCase | `analyzeCode` |
| Constantes | UPPER_SNAKE | `DEFAULT_CONFIG` |
| Types/Interfaces | PascalCase | `ProjectStructure` |

### Imports

```typescript
// 1. Bibliotecas externas
import { chromium } from 'playwright';
import { z } from 'zod';

// 2. Módulos internos (absolutos)
import { logger } from '../../config/index.js';

// 3. Types
import type { AgentConfig } from './types.js';
```

### Exports

```typescript
// index.ts de cada módulo exporta API pública
export { SmartBrowserAgent } from './smart-agent.js';
export type { AgentConfig } from './types.js';
```

