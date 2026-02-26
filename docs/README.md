# Keelo - Documentação

Sistema de QA Autônomo baseado em IA para análise de PRs, geração de testes e exploração automática.

## 📚 Índice

### Início Rápido
- [Instalação](./installation.md)
- [Configuração](./configuration.md)
- [Primeiros Passos](./getting-started.md)

### Funcionalidades
- [Análise de PRs](./features/pr-analysis.md)
- [Análise de Requisitos](./features/requirements-analysis.md)
- [Geração de Testes](./features/test-generation.md)
- [Runtime Explorer](./features/runtime-explorer.md)
- [Dashboard](./features/dashboard.md)

### Arquitetura
- [Visão Geral](./architecture/overview.md)
- [Backend API](./architecture/backend.md)
- [Frontend Dashboard](./architecture/frontend.md)
- [Runtime Agent](./architecture/runtime-agent.md)
- [Code-Aware](./architecture/code-aware.md)

### Integrações
- [GitHub](./integrations/github.md)
- [Slack](./integrations/slack.md)
- [LLM Providers](./integrations/llm.md)

### Referência
- [Comandos /keelo](./reference/commands.md)
- [API REST](./reference/api.md)
- [Configuração .keelo.json](./reference/keelo-config.md)

### Desenvolvimento
- [Contribuição](./development/contributing.md)
- [Estrutura de Pastas](./development/folder-structure.md)
- [Migrações](./development/migrations.md)

---

## 🚀 O que é o Keelo?

O Keelo é um sistema de QA autônomo que:

1. **Analisa PRs automaticamente** - Detecta riscos, sugere cenários de teste
2. **Gera testes** - Cria testes Playwright/Vitest baseados em mudanças
3. **Explora aplicações** - Runtime Agent que navega e encontra bugs
4. **Aprende e melhora** - Feedback loop para melhorar análises

## 🎯 Para quem é?

- **QAs solo** que precisam escalar sem contratar
- **Times com foco em "AI First"**
- **Empresas que querem QA proativo, não reativo**

## 📊 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                         KEELO                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│   │   GitHub    │     │   Backend   │     │  Dashboard  │  │
│   │   Webhooks  │────▶│   Node.js   │◀────│   React     │  │
│   └─────────────┘     └─────────────┘     └─────────────┘  │
│                              │                              │
│                              ▼                              │
│                    ┌─────────────────┐                     │
│                    │   PostgreSQL    │                     │
│                    │   (Histórico)   │                     │
│                    └─────────────────┘                     │
│                              │                              │
│         ┌────────────────────┼────────────────────┐        │
│         ▼                    ▼                    ▼        │
│   ┌───────────┐        ┌───────────┐        ┌───────────┐  │
│   │ Anthropic │        │  Runtime  │        │   Slack   │  │
│   │   Claude  │        │  Agent    │        │  Notify   │  │
│   └───────────┘        │ Playwright│        └───────────┘  │
│                        └───────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📖 Próximos Passos

1. [Instalar o Keelo](./installation.md)
2. [Configurar no seu projeto](./configuration.md)
3. [Ver o Dashboard](./features/dashboard.md)

