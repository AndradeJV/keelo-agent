# Análise de PRs

O Keelo analisa Pull Requests automaticamente para detectar riscos e sugerir testes.

## Como Funciona

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  GitHub PR  │────▶│   Webhook   │────▶│   Keelo     │
│  (opened)   │     │   /webhook  │     │   Backend   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌───────────┐
                                        │   Claude  │
                                        │   (LLM)   │
                                        └───────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              ┌───────────┐            ┌───────────┐            ┌───────────┐
              │  Análise  │            │  Gerar    │            │  Comentar │
              │  de Risco │            │  Testes   │            │  no PR    │
              └───────────┘            └───────────┘            └───────────┘
```

## O que é Analisado

### 1. Riscos

O Keelo identifica riscos em 5 níveis:

| Nível | Descrição | Exemplo |
|-------|-----------|---------|
| 🔴 Crítico | Pode causar perda de dados | Mudança em SQL DELETE |
| 🟠 Alto | Impacto significativo | Mudança em autenticação |
| 🟡 Médio | Precisa atenção | Mudança em validação |
| 🟢 Baixo | Mínimo impacto | Refatoração de código |
| ⚪ Informativo | Apenas observação | Atualização de docs |

### 2. Áreas Afetadas

- Autenticação
- Pagamentos
- Dados sensíveis
- UI/UX
- Performance
- API

### 3. Cenários de Teste

Para cada risco, o Keelo sugere:

```markdown
## Cenário: Login com credenciais válidas

**Dado** que o usuário está na página de login
**Quando** preenche email e senha corretos
**E** clica em "Entrar"
**Então** deve ser redirecionado ao dashboard
```

### 4. Cobertura de Testes

O Keelo verifica:
- Se os arquivos alterados têm testes
- Se a cobertura está abaixo do threshold
- Quais linhas precisam de testes

## Comentário no PR

Após análise, o Keelo comenta no PR:

```markdown
# 🤖 Keelo QA Analysis

## 📊 Resumo
- **Risco Geral:** 🟠 Alto
- **Arquivos analisados:** 5
- **Riscos encontrados:** 3

## 🎯 Riscos Identificados

### 1. Mudança em autenticação
- **Área:** auth/login.ts
- **Risco:** Alto
- **Recomendação:** Adicionar testes E2E

### 2. Query SQL sem sanitização
- **Área:** api/users.ts
- **Risco:** Crítico
- **Recomendação:** Usar prepared statements

## 📝 Cenários de Teste Sugeridos

1. Login com credenciais válidas
2. Login com senha incorreta
3. Timeout na API de autenticação

## ✅ Testes Gerados

Um PR foi criado com testes automatizados:
- [PR #123: tests: add auth tests](link)

---
_Feedback? Reaja com 👍 ou 👎_
```

## Modos de Trigger

### Automático (padrão)

```yaml
trigger: auto
```

O Keelo analisa quando:
- PR é aberto
- PR é atualizado (novo commit)
- PR é reaberto

### Via Comando

```yaml
trigger: command
```

Comente no PR:
```
/keelo analyze
```

## Integração com CI

O Keelo pode:

1. **Gerar PR de testes** - Abre um PR com testes gerados
2. **Monitorar CI** - Acompanha se os testes passam
3. **Auto-fix** - Corrige testes que falham

Configure em **Configurações → Ações Automáticas**.

## Hot Spots

O Keelo mantém histórico de riscos por área do código:

```
┌────────────────────────────────┬───────┬──────────┐
│ Área                           │ Riscos│ Tendência│
├────────────────────────────────┼───────┼──────────┤
│ src/api/auth/                  │ 12    │ ↗️       │
│ src/services/payment/          │ 8     │ →        │
│ src/components/Form/           │ 5     │ ↘️       │
└────────────────────────────────┴───────┴──────────┘
```

Áreas com mais riscos recebem mais atenção nas análises.

## Próximos Passos

- [Geração de Testes](./test-generation.md)
- [Comandos /keelo](../reference/commands.md)

