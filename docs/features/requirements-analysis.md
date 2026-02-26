# Análise de Requisitos (Left Testing)

O Keelo analisa requisitos, user stories e mockups **antes** do desenvolvimento para identificar problemas antecipadamente.

## Conceito

```
┌────────────────────────────────────────────────────────────┐
│                     LEFT TESTING                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   TRADICIONAL (Right Testing)                              │
│   ──────────────────────────────────────────────────────   │
│   Requisitos → Desenvolvimento → [TESTE] → Produção       │
│                                     ↑                      │
│                               Tarde demais!                │
│                                                            │
│   LEFT TESTING                                             │
│   ──────────────────────────────────────────────────────   │
│   Requisitos → [ANÁLISE] → Desenvolvimento → Teste        │
│                    ↑                                       │
│              Encontrar problemas ANTES                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## O que o Keelo Analisa

### Fontes de Entrada

| Tipo | Como usar |
|------|-----------|
| **User Story** | Cole o texto no Dashboard |
| **PDF** | Upload de documento |
| **Figma** | Cole URL ou imagem |
| **Texto livre** | Descrição do requisito |

### Saídas da Análise

#### 1. Gaps (Problemas nos Requisitos)

| Tipo | Descrição |
|------|-----------|
| `ambiguity` | Linguagem vaga ou dupla interpretação |
| `missing_criterion` | Critério de aceite ausente |
| `dangerous_assumption` | Hipótese perigosa não explicitada |
| `implicit_criterion` | Critério implícito que deveria ser explícito |
| `unclear_behavior` | Comportamento esperado não está claro |

**Exemplo:**
```json
{
  "type": "ambiguity",
  "severity": "high",
  "description": "'O sistema deve ser rápido' - o que é rápido? 1s? 5s?",
  "location": "Requisito 3",
  "recommendation": "Defina: 'Tempo de resposta máximo de 2 segundos'"
}
```

#### 2. Riscos

| Área | Exemplos |
|------|----------|
| Segurança | "Permite upload de qualquer arquivo" |
| Performance | "Carregar todos os registros de uma vez" |
| Dados | "Não menciona backup ou rollback" |
| UX | "Não especifica feedback de erro" |

#### 3. Cenários de Teste

O Keelo gera cenários no formato BDD:

```gherkin
Funcionalidade: Cadastro de usuário

  Cenário: Cadastro com dados válidos
    Dado que o usuário está na página de cadastro
    Quando preenche nome "João"
    E preenche email "joao@email.com"
    E preenche senha "Senha123!"
    E clica em "Cadastrar"
    Então deve ver mensagem "Cadastro realizado"

  Cenário: Cadastro com email duplicado
    Dado que existe um usuário com email "joao@email.com"
    Quando tenta cadastrar com mesmo email
    Então deve ver erro "Email já cadastrado"
```

#### 4. Recomendações

Sugestões práticas para melhorar os requisitos.

## Como Usar

### Via Dashboard

1. Acesse http://localhost:3001
2. Clique em **Left Testing**
3. Escolha o tipo de entrada
4. Cole/upload o conteúdo
5. Clique em **Analisar**

### Via API

```bash
curl -X POST http://localhost:3000/analyze/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cadastro de Usuário",
    "content": "Como usuário, quero me cadastrar para acessar o sistema",
    "source": "user_story"
  }'
```

## Cenários Persistidos

Os cenários gerados são salvos no banco de dados:

```sql
SELECT * FROM test_scenarios 
WHERE analysis_id = 'abc-123';
```

Você pode acessar depois via Dashboard para:
- Ver cenários gerados
- Exportar para Playwright
- Marcar como implementado

## Integração com Right Testing

Os riscos identificados no Left Testing são correlacionados com o Right Testing:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   LEFT TESTING                  RIGHT TESTING           │
│   ─────────────                 ────────────            │
│                                                          │
│   Risco: "Não valida email"  →  PR muda validação      │
│                                  ↓                       │
│                               Keelo verifica se         │
│                               validação foi adicionada   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Melhores Práticas

### Para User Stories

Garanta que a story tenha:
- ✅ "Como [persona]"
- ✅ "Quero [ação]"
- ✅ "Para [benefício]"
- ✅ Critérios de aceite
- ✅ Casos de erro

### Para Mockups

Inclua:
- ✅ Estados de erro
- ✅ Loading states
- ✅ Empty states
- ✅ Mensagens de feedback

## Próximos Passos

- [Análise de PRs](./pr-analysis.md)
- [Geração de Testes](./test-generation.md)

