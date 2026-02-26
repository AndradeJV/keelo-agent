# Configuração

O Keelo é configurado **exclusivamente via Dashboard**. Todas as configurações são armazenadas no banco de dados.

## Acessando Configurações

1. Abra o Dashboard: http://localhost:3001
2. Clique em **Configurações** no menu lateral
3. Edite os campos desejados
4. Clique em **Salvar**

As mudanças são aplicadas imediatamente, sem necessidade de restart.

## Seções de Configuração

### 🌐 Geral

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Idioma | Idioma das análises (pt-br, en) | pt-br |
| Modo de Trigger | Como o Keelo é ativado | auto |

**Modos de Trigger:**
- `auto`: Analisa automaticamente ao abrir/atualizar PR
- `command`: Só analisa quando chamado via `/keelo analyze`

### 🤖 Modelo de IA

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Provedor | Anthropic ou OpenAI | Anthropic |
| Modelo | Modelo específico do provedor | Claude Sonnet 4 |
| Temperature | Criatividade (0-1) | 0.2 |
| Max Tokens | Limite de tokens por chamada | 16000 |

**Modelos recomendados:**
- Anthropic: `claude-sonnet-4-20250514` (melhor custo-benefício)
- OpenAI: `gpt-4o` (mais rápido)

### 🔧 Ações Automáticas

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Gerar testes automaticamente | Criar testes após análise | ✅ |
| Criar issues automaticamente | Criar issues para riscos | ❌ |
| Criar PRs como Draft | PRs de teste são drafts | ✅ |
| Labels de Issues | Tags para issues criadas | keelo, qa |

**Modo Autônomo:**
- Habilitado: Keelo age automaticamente
- Criar PRs de teste: Abre PRs com testes gerados
- Monitorar CI: Acompanha se testes passam
- Auto-fix de CI: Corrige testes que falham

### 🔔 Notificações Slack

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Slack habilitado | Enviar notificações | ❌ |
| Canal | Canal para notificações | #qa-alerts |
| Webhook URL | URL do webhook do Slack | - |

**Notificar quando:**
- Análise: Quando uma análise é concluída
- PR criado: Quando um PR de teste é criado
- CI falhou: Quando testes falham no CI
- Risco crítico: Quando detecta risco crítico

### ⚡ Runtime Explorer

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Runtime habilitado | Exploração automática | ❌ |
| Timezone | Fuso horário para agendamento | America/Sao_Paulo |
| Agendamento (Cron) | Quando executar | 0 3 * * * |
| Máx. Páginas | Limite de páginas a explorar | 50 |
| Profundidade | Níveis de navegação | 3 |

**Code-Aware (Opcional):**
- Habilitar análise de código: Ler código fonte
- Caminho do repositório: `/Users/you/project`
- Repositório GitHub: `owner/repo`

### 🛡️ Cobertura

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Análise habilitada | Analisar cobertura | ✅ |
| Threshold mínimo | % mínima de cobertura | 80 |
| Falhar se diminuir | Bloquear se coverage cair | ❌ |
| Sugerir testes | Sugerir onde adicionar | ✅ |

### 💬 Feedback & Aprendizado

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Sistema habilitado | Coletar feedback | ✅ |
| Coletar reações | 👍👎 em comentários | ✅ |
| Usar aprendizado | Melhorar com feedback | ✅ |
| Mostrar estatísticas | Exibir métricas no PR | ✅ |

## Variáveis de Ambiente

Algumas configurações sensíveis devem ficar no `.env`:

```env
# Credenciais de API (obrigatório)
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA..."
GITHUB_WEBHOOK_SECRET=secret

# Credenciais para Runtime (opcional)
STAGING_USER=user@example.com
STAGING_PASS=password

# Slack (opcional - pode ser configurado no Dashboard)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Configuração por Projeto

O Keelo detecta automaticamente:

- **Frameworks de teste**: Lê o `package.json` para identificar Playwright, Jest, Vitest, etc.
- **Estrutura de pastas**: Segue a estrutura existente de testes
- **Padrões de código**: Aprende com testes já escritos

**O Keelo sempre prioriza o que já existe no projeto.**

## Resetar Configurações

Para voltar aos valores padrão:

1. Acesse **Configurações**
2. Clique em **Restaurar**
3. Confirme a ação

## Próximos Passos

- [Primeiros Passos](./getting-started.md)
- [Análise de PRs](./features/pr-analysis.md)

