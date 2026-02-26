# Dashboard

O Dashboard do Keelo é a interface central para gerenciar e visualizar todas as funcionalidades.

## Acessando

```
http://localhost:3001
```

## Páginas

### 📊 Dashboard (Home)

Visão geral de métricas:

| Métrica | Descrição |
|---------|-----------|
| Total de Análises | Quantidade de PRs analisados |
| Riscos Detectados | Por severidade (crítico, alto, médio, baixo) |
| Testes Gerados | PRs de teste criados |
| Hot Spots | Áreas com mais riscos |

**Filtro por Projeto:**
- Selecione um projeto específico
- Ou veja métricas gerais

**Análises Recentes:**
- Lista das últimas análises
- Clique para ver detalhes

### 📝 Left Testing

Análise de requisitos antes do desenvolvimento:

1. **Entrada**
   - Cole texto da user story
   - Upload de PDF
   - URL do Figma

2. **Análise**
   - Gaps identificados
   - Riscos
   - Cenários de teste sugeridos

3. **Ações**
   - Salvar cenários
   - Exportar para Playwright

### 🔍 Análise de PR

Análise manual de PRs:

1. Cole URL do PR
2. Clique em **Analisar**
3. Veja:
   - Riscos identificados
   - Cenários sugeridos
   - Testes gerados

### 🏥 QA Health

Métricas de saúde do QA:

| Seção | Métricas |
|-------|----------|
| **Cobertura** | % por área do código |
| **Riscos** | Hot spots, tendências |
| **Autonomia** | PRs auto-corrigidos, bugs encontrados |
| **ROI** | Tempo economizado, bugs prevenidos |

### ⚡ Runtime

Exploração automática:

| Funcionalidade | Descrição |
|----------------|-----------|
| **Execuções** | Histórico de explorações |
| **Executar Agora** | Trigger manual |
| **Configuração** | Agendamento, credenciais |
| **Tokens** | Consumo de LLM |
| **Bugs** | Lista de bugs encontrados |

### ⚙️ Configurações

Todas as configurações do Keelo:

- Geral (idioma, trigger)
- Modelo de IA
- Ações automáticas
- Notificações Slack
- Runtime Explorer
- Cobertura
- Feedback

## Navegação

```
┌─────────────────────────────────────────────────────────────┐
│  🔵 Keelo                              [Projeto ▾]  [User]  │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────┐                                           │
│ │ 📊 Dashboard  │                                           │
│ │ 📝 Left Test  │                                           │
│ │ 🔍 PR Análise │     [Conteúdo principal aqui]             │
│ │ 🏥 QA Health  │                                           │
│ │ ⚡ Runtime    │                                           │
│ │ ⚙️ Config     │                                           │
│ └───────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Temas

O Dashboard usa tema dark por padrão:

- Background: `#0f1117`
- Cards: `#1a1d27`
- Accent: Gradiente roxo/azul

## Responsividade

O Dashboard é responsivo:
- Desktop: Menu lateral fixo
- Mobile: Menu colapsável

## Atualização em Tempo Real

Usa WebSocket para:
- Status de análises em andamento
- Novos bugs detectados pelo Runtime
- Notificações

## Próximos Passos

- [Configuração](../configuration.md)
- [API REST](../reference/api.md)

