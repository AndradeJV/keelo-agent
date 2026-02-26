# 🏗️ Arquitetura do Keelo

Este documento descreve a arquitetura e as decisões de design do Keelo QA Agent.

---

## Visão Geral

O Keelo segue uma **arquitetura modular em camadas** projetada para:

- **Separação de Responsabilidades** - Cada módulo tem uma única responsabilidade
- **Testabilidade** - Lógica de negócio isolada da infraestrutura
- **Extensibilidade** - Fácil adicionar novas integrações ou funcionalidades
- **Manutenibilidade** - Organização clara do código

---

## Camadas Arquiteturais

```
┌─────────────────────────────────────────────────────────────┐
│                      Camada de API                          │
│                  (Servidor HTTP Express)                    │
├─────────────────────────────────────────────────────────────┤
│                      Camada Core                            │
│   (Orchestrator, Analyzer, Formatter, Test Generator)       │
├─────────────────────────────────────────────────────────────┤
│                  Camada de Integrações                      │
│             (GitHub, Slack, Provedores LLM)                 │
├─────────────────────────────────────────────────────────────┤
│                    Camada de Config                         │
│            (Environment, Keelo Config, Logger)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Descrição dos Módulos

### 📡 Camada de API (`src/api/`)

**Propósito:** Interface HTTP para receber webhooks do GitHub.

| Arquivo | Responsabilidade |
|---------|------------------|
| `server.ts` | App Express, rotas, middlewares |
| `index.ts` | Exports do módulo |

**Recursos Principais:**
- Verificação de assinatura do webhook
- Processamento assíncrono de eventos (responde 202 imediatamente)
- Endpoint de health check

### ⚙️ Camada Core (`src/core/`)

**Propósito:** Lógica de negócio e operações de domínio.

| Arquivo | Responsabilidade |
|---------|------------------|
| `orchestrator.ts` | Coordenador principal do fluxo |
| `analyzer.ts` | Análise de PR com LLM |
| `formatter.ts` | Geração de comentários Markdown |
| `llm.ts` | Abstração do provedor LLM |
| `test-generator.ts` | Geração de código de teste |
| `autonomous-executor.ts` | Orquestração do modo autônomo |
| `types.ts` | Interfaces TypeScript |

**Fluxo do Orchestrator:**

```
Webhook → Buscar Detalhes PR → Analisar com LLM → Executar Ações → Postar Comentário
                                                         │
                                                         ├── Gerar Testes
                                                         ├── Criar Issues
                                                         ├── Criar PR de Testes
                                                         └── Enviar Notificações
```

### 🔌 Camada de Integrações (`src/integrations/`)

**Propósito:** Comunicação com serviços externos.

#### GitHub (`integrations/github/`)

| Arquivo | Responsabilidade |
|---------|------------------|
| `client.ts` | Cliente Octokit, verificação de webhook |
| `git-operations.ts` | Operações de branch, commit, push |
| `pr-creator.ts` | Criação de PR, monitoramento de CI |
| `issue-creator.ts` | Criação de issues e tasks |
| `pattern-detector.ts` | Detecção de padrões de teste |

#### Slack (`integrations/slack/`)

| Arquivo | Responsabilidade |
|---------|------------------|
| `client.ts` | Notificações via webhook |

### ⚡ Camada de Config (`src/config/`)

**Propósito:** Gerenciamento de configuração da aplicação.

| Arquivo | Responsabilidade |
|---------|------------------|
| `env.ts` | Carregamento de variáveis de ambiente (`.env`) |
| `keelo-config.ts` | Configuração do Keelo (`.keelo.json`) |
| `logger.ts` | Configuração do logger Pino |

---

## Fluxo de Dados

### 1. Recepção do Webhook

```
GitHub → POST /webhook → Verificação de Assinatura → Parsing do Evento
```

### 2. Análise do PR

```
Buscar Detalhes PR → Construir Prompt → Chamar LLM → Parsear Resposta JSON
       │                                                     │
       └── título, body, diff                               └── AnalysisResult
```

### 3. Execução de Ações

```
Análise Completa
       │
       ├─[autonomous=true]─→ Gerar Testes → Criar Branch → Commit → Criar PR
       │                                                                 │
       │                                                  Monitorar CI ←─┘
       │
       └─[autonomous=false]─→ Formatar Comentário → Postar no PR
```

### 4. Notificação

```
Ação Completa → Verificar Config → Construir Mensagem → Enviar para Slack
```

---

## Padrões de Design Principais

### 1. Abstração de Provedor (LLM)

```typescript
// src/core/llm.ts
export async function callLLM(options: LLMCallOptions): Promise<string> {
  const provider = getLLMConfig().provider;
  
  if (provider === 'anthropic') {
    return callAnthropic(...);
  } else {
    return callOpenAI(...);
  }
}
```

**Benefícios:**
- Fácil trocar de provedor
- Interface consistente para chamadores
- Otimizações específicas por provedor

### 2. Camadas de Configuração

```
.env (segredos) → env.ts → objeto config
.keelo.json (comportamento) → keelo-config.ts → objeto keeloConfig
```

**Benefícios:**
- Segredos no ambiente (nunca commitados)
- Config de comportamento em JSON (pode ser commitado)
- Acesso type-safe com validação Zod

### 3. Processamento Assíncrono de Webhook

```typescript
// Responde imediatamente
res.status(202).json({ message: 'Processing' });

// Processa assincronamente
try {
  await handlePullRequestEvent(req.body);
} catch (error) {
  logger.error({ error }, 'Failed to handle webhook');
}
```

**Benefícios:**
- Timeout do webhook do GitHub (10s) não é problema
- Melhor confiabilidade
- Sem requisições penduradas

### 4. Padrão de Index por Módulo

Cada módulo expõe um único `index.ts` com exports limpos:

```typescript
// src/core/index.ts
export { analyzePullRequest } from './analyzer.js';
export { formatComment } from './formatter.js';
export { callLLM } from './llm.js';
// ...
```

**Benefícios:**
- Caminhos de import limpos
- Encapsulamento da estrutura interna
- Refatoração facilitada

---

## Sistema de Tipos

### Tipos Principais

```typescript
interface PullRequestContext {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string | null;
  diff: string;
  action: string;
  installationId: number;
}

interface AnalysisResult {
  version: string;
  analyzedAt: string;
  summary: { title, description, impactAreas, changeType };
  overallRisk: RiskLevel;
  risks: RiskAssessment[];
  scenarios: TestScenario[];
  gaps: Gap[];
  acceptanceCriteria: string[];
  testCoverage: { unit, integration, e2e, manual };
  raw: string;
}
```

### Taxonomia de Cenários

```typescript
type ScenarioCategory = 
  | 'happy_path'
  | 'sad_path'
  | 'edge_case'
  | 'boundary'
  | 'security'
  | 'performance'
  | 'accessibility'
  | 'integration'
  | 'data_integrity';
```

---

## Tratamento de Erros

### Estratégia

1. **Try-Catch nas fronteiras** - Camada de API captura todos os erros
2. **Degradação graciosa** - Posta comentário de erro se análise falhar
3. **Logging estruturado** - Todos os erros logados com contexto
4. **Não-bloqueante** - Falhas de webhook não derrubam o servidor

### Exemplo

```typescript
try {
  await handlePullRequestEvent(req.body);
} catch (error) {
  logger.error({ error, deliveryId }, 'Failed to handle webhook');
  
  // Tenta postar comentário de erro
  try {
    await postComment(installationId, owner, repo, prNumber, formatErrorComment(error));
  } catch (commentError) {
    logger.error({ commentError }, 'Failed to post error comment');
  }
}
```

---

## Considerações de Segurança

1. **Verificação de Webhook** - Todos os webhooks verificados com HMAC
2. **Segredos no Ambiente** - Nunca em arquivos de config
3. **Tratamento de Chave Privada** - Newlines escapados corretamente
4. **Rate Limiting** - Limites da API do GitHub respeitados
5. **Escopo de Token** - Permissões do GitHub App minimizadas

---

## Pontos de Extensibilidade

### Adicionando um Novo Provedor LLM

1. Adicione a API key em `src/config/env.ts`
2. Adicione opção do provedor em `src/config/keelo-config.ts`
3. Adicione implementação em `src/core/llm.ts`

### Adicionando um Novo Canal de Notificação

1. Crie `src/integrations/novocanal/client.ts`
2. Adicione schema de config em `src/config/keelo-config.ts`
3. Chame a partir de `src/core/orchestrator.ts`

### Adicionando um Novo Framework de Teste

1. Adicione ao schema `testFrameworks` em `src/config/keelo-config.ts`
2. Adicione detecção em `src/integrations/github/pattern-detector.ts`
3. Adicione tratamento de template em `src/core/test-generator.ts`

---

## Considerações de Performance

1. **Truncamento de Diff** - Diffs grandes truncados para 15000 caracteres
2. **Operações Paralelas** - Detalhes e diff do PR buscados em paralelo
3. **Monitoramento de CI Assíncrono** - Não-bloqueante com verificações agendadas
4. **Limitação de Exemplos** - Exemplos de teste limitados a 3 por tipo

---

## Dependências

| Pacote | Propósito |
|--------|-----------|
| `express` | Servidor HTTP |
| `@octokit/rest` | Cliente da API do GitHub |
| `@octokit/webhooks` | Verificação de webhook |
| `@octokit/auth-app` | Autenticação do GitHub App |
| `openai` | Cliente da API OpenAI |
| `@anthropic-ai/sdk` | Cliente da API Anthropic |
| `zod` | Validação de schema |
| `pino` | Logging estruturado |
| `dotenv` | Carregamento de ambiente |

---

## Considerações Futuras

1. **Banco de Dados** - Armazenar histórico de análises
2. **Fila** - Lidar com alto volume de webhooks
3. **Cache** - Cachear análises similares
4. **Multi-tenant** - Suporte a múltiplas orgs
5. **Métricas** - Rastrear qualidade das análises
