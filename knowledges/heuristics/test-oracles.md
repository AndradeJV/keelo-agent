# Test Oracles - Como Saber se o Resultado Está Correto

## Definição

Um **test oracle** é um mecanismo para determinar se o software produziu o resultado correto para um dado teste. Em outras palavras, é a fonte de verdade contra a qual comparamos o comportamento do sistema.

## Tipos de Oracles

### 1. Oracle por Especificação

**Descrição**: Comparar resultado com documentação/requisitos formais.

**Quando Usar**:
- Requisitos bem documentados
- Regras de negócio claras
- APIs com contrato definido

**Exemplo**:
```gherkin
# Especificação: "Desconto de 10% para compras acima de R$ 100"

Cenário: Verificar desconto contra especificação
  Dado carrinho com total de R$ 150
  Quando calculo desconto
  Então o desconto deve ser R$ 15 (10% de 150)
  # Oracle: Especificação de regras de negócio
```

### 2. Oracle por Consistência

**Descrição**: Verificar se resultados são consistentes em diferentes situações.

**Quando Usar**:
- Operações que devem ser idempotentes
- Dados que devem ser coerentes entre si
- Ações repetidas

**Exemplo**:
```gherkin
Cenário: Consistência entre lista e detalhe
  Dado que vejo o produto na lista com preço "R$ 99,90"
  Quando abro o detalhe do produto
  Então o preço deve ser "R$ 99,90"
  # Oracle: Consistência entre telas

Cenário: Idempotência de operação
  Dado que salvo o documento
  Quando salvo novamente sem alterar
  Então o resultado deve ser idêntico
  # Oracle: Consistência de operação repetida
```

### 3. Oracle por Comparação

**Descrição**: Comparar resultado com outro sistema, versão ou implementação de referência.

**Quando Usar**:
- Migração de sistemas
- Refatoração
- Múltiplas implementações

**Exemplo**:
```gherkin
Cenário: Cálculo igual ao sistema legado
  Dado os mesmos dados de entrada
  Quando calculo no sistema novo
  E calculo no sistema legado
  Então os resultados devem ser iguais
  # Oracle: Sistema de referência

Cenário: API v2 compatível com v1
  Dado request válido para v1
  Quando envio para /api/v2
  Então resposta deve ter mesma estrutura
  # Oracle: Versão anterior
```

### 4. Oracle Estatístico

**Descrição**: Usar análise estatística para detectar anomalias.

**Quando Usar**:
- Sistemas com saídas não determinísticas
- Performance testing
- Detecção de regressão

**Exemplo**:
```gherkin
Cenário: Performance dentro do esperado
  Dado que executo a operação 100 vezes
  Quando calculo média e desvio padrão
  Então 95% das execuções devem estar abaixo de 500ms
  # Oracle: Threshold estatístico

Cenário: Distribuição de resultados
  Dado que processo 10.000 registros
  Quando verifico taxa de erros
  Então deve ser menor que 0.1%
  # Oracle: Limite estatístico
```

### 5. Oracle Heurístico

**Descrição**: Usar regras práticas e bom senso para julgar resultados.

**Quando Usar**:
- Requisitos vagos
- Teste exploratório
- Avaliação de UX

**Exemplo**:
```gherkin
Cenário: Tempo de resposta aceitável
  Dado que faço uma busca simples
  Quando aguardo resultado
  Então deve parecer "instantâneo" (< 100ms)
  # Oracle: Percepção do usuário

Cenário: Mensagem de erro útil
  Dado que informo dado inválido
  Quando vejo a mensagem de erro
  Então deve ser compreensível por usuário não-técnico
  # Oracle: Julgamento humano
```

### 6. Oracle por Consistência Interna

**Descrição**: Verificar regras que os dados devem sempre respeitar.

**Quando Usar**:
- Integridade de dados
- Invariantes de negócio
- Validações cruzadas

**Exemplo**:
```gherkin
Cenário: Total igual à soma dos itens
  Dado um pedido com vários itens
  Quando verifico o total
  Então deve ser igual à soma (quantidade * preço) de cada item
  # Oracle: Invariante matemático

Cenário: Saldo não pode ser negativo
  Dado uma conta com saldo R$ 100
  Quando tento sacar R$ 150
  Então o saque deve ser negado
  # Oracle: Regra de negócio invariante
```

### 7. Oracle por Reversibilidade

**Descrição**: Verificar se operações inversas retornam ao estado original.

**Quando Usar**:
- Operações CRUD
- Conversões de formato
- Criptografia/decriptografia

**Exemplo**:
```gherkin
Cenário: Encode e decode são inversos
  Dado texto "Hello, 世界!"
  Quando faço encode para Base64
  E faço decode do resultado
  Então devo obter "Hello, 世界!"
  # Oracle: Reversibilidade de operação

Cenário: Delete e restore
  Dado um documento existente
  Quando deleto o documento
  E restauro da lixeira
  Então o documento deve estar idêntico ao original
  # Oracle: Reversibilidade de estado
```

## Oracles para Cenários Específicos

### E-commerce

| Situação | Oracle |
|----------|--------|
| Cálculo de frete | Tabela de frete da transportadora |
| Cálculo de imposto | Legislação tributária |
| Estoque | Soma de entradas - soma de saídas |
| Desconto | Regras de promoção documentadas |

### Financeiro

| Situação | Oracle |
|----------|--------|
| Juros | Fórmula matemática definida |
| Saldo | Saldo anterior + créditos - débitos |
| Conciliação | Sistema bancário externo |
| Relatórios | Soma dos lançamentos |

### Healthcare

| Situação | Oracle |
|----------|--------|
| Dosagem | Protocolos médicos |
| Interação medicamentosa | Base de dados farmacológica |
| Faixas de referência | Guidelines médicos |
| Cálculos clínicos | Fórmulas validadas |

## Quando Não Há Oracle Claro

### Estratégias

1. **Smoke Test**: Verificar se não quebra
2. **Peer Review**: Outro especialista valida
3. **A/B Testing**: Comparar comportamentos
4. **User Acceptance**: Usuário final valida
5. **Exploratory Testing**: Testador experiente investiga

### Exemplo de Cenário sem Oracle Claro

```gherkin
Cenário: IA gera texto de qualidade
  Dado um prompt de entrada
  Quando a IA gera resposta
  Então a resposta deve ser revisada por humano
  # Oracle: Julgamento humano necessário
```

## Referência

ISTQB Foundation Syllabus - Section 1.1.2
Cem Kaner - What Is a Good Test Case?

