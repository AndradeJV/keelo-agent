# Tabela de Decisão (Decision Table Testing)

## Definição

Técnica de teste caixa-preta que representa combinações de condições de entrada e suas ações resultantes de forma tabular, garantindo cobertura de todas as regras de negócio.

## Fundamento

Sistemas complexos possuem múltiplas condições que, combinadas, produzem diferentes resultados. A tabela de decisão garante que todas as combinações relevantes sejam testadas.

## Estrutura da Tabela

```
┌─────────────────────┬───────┬───────┬───────┬───────┐
│                     │ R1    │ R2    │ R3    │ R4    │
├─────────────────────┼───────┼───────┼───────┼───────┤
│ CONDIÇÕES           │       │       │       │       │
├─────────────────────┼───────┼───────┼───────┼───────┤
│ Condição 1          │ V     │ V     │ F     │ F     │
│ Condição 2          │ V     │ F     │ V     │ F     │
├─────────────────────┼───────┼───────┼───────┼───────┤
│ AÇÕES               │       │       │       │       │
├─────────────────────┼───────┼───────┼───────┼───────┤
│ Ação 1              │ X     │       │ X     │       │
│ Ação 2              │       │ X     │       │ X     │
└─────────────────────┴───────┴───────┴───────┴───────┘

V = Verdadeiro, F = Falso, X = Executar ação
R = Regra (combinação)
```

## Cálculo de Combinações

Para n condições binárias: 2^n regras

| Condições | Regras |
|-----------|--------|
| 2 | 4 |
| 3 | 8 |
| 4 | 16 |
| 5 | 32 |

## Exemplo Prático: Desconto em E-commerce

### Regras de Negócio
- Cliente VIP recebe 20% de desconto
- Compras acima de R$ 500 recebem 10% de desconto
- Frete grátis para compras acima de R$ 200
- Descontos são cumulativos

### Tabela de Decisão

```
┌─────────────────────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┐
│                     │ R1    │ R2    │ R3    │ R4    │ R5    │ R6    │ R7    │ R8    │
├─────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ CONDIÇÕES           │       │       │       │       │       │       │       │       │
├─────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ Cliente VIP         │ V     │ V     │ V     │ V     │ F     │ F     │ F     │ F     │
│ Compra > R$ 500     │ V     │ V     │ F     │ F     │ V     │ V     │ F     │ F     │
│ Compra > R$ 200     │ V     │ F     │ V     │ F     │ V     │ F     │ V     │ F     │
├─────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ AÇÕES               │       │       │       │       │       │       │       │       │
├─────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ Desconto 20%        │ X     │ X     │ X     │ X     │       │       │       │       │
│ Desconto 10%        │ X     │ X     │       │       │ X     │ X     │       │       │
│ Frete grátis        │ X     │       │ X     │       │ X     │       │ X     │       │
├─────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ RESULTADO           │       │       │       │       │       │       │       │       │
├─────────────────────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ Desconto total      │ 30%   │ 30%   │ 20%   │ 20%   │ 10%   │ 10%   │ 0%    │ 0%    │
│ Frete               │ Grátis│ Pago  │ Grátis│ Pago  │ Grátis│ Pago  │ Grátis│ Pago  │
└─────────────────────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

## Otimização: Regras Impossíveis

Algumas combinações são logicamente impossíveis e podem ser eliminadas:

```
Se Compra > R$ 500, então necessariamente Compra > R$ 200
Portanto, R2 e R6 são impossíveis (> 500 mas não > 200)
```

## Exemplo de Cenário

```gherkin
Funcionalidade: Cálculo de desconto no checkout

Cenário: Cliente VIP com compra alta (R1)
  Dado que sou cliente VIP
  E meu carrinho tem total de R$ 600
  Quando finalizo a compra
  Então devo receber desconto de 30%
  E o frete deve ser grátis

Cenário: Cliente comum com compra média (R7)
  Dado que sou cliente comum
  E meu carrinho tem total de R$ 250
  Quando finalizo a compra
  Então não devo receber desconto
  E o frete deve ser grátis

Cenário: Cliente comum com compra baixa (R8)
  Dado que sou cliente comum
  E meu carrinho tem total de R$ 150
  Quando finalizo a compra
  Então não devo receber desconto
  E o frete deve ser cobrado
```

## Quando Usar

- ✅ Regras de negócio com múltiplas condições
- ✅ Cálculos de preços/descontos
- ✅ Sistemas de permissões
- ✅ Fluxos de aprovação
- ✅ Validações complexas
- ✅ Elegibilidade de produtos/serviços

## Defeitos Típicos Detectados

- Combinações não implementadas
- Lógica de negócio incorreta
- Condições conflitantes
- Ações faltando para certas regras
- Prioridade incorreta entre regras

## Referência ISTQB

Seção 4.2.3 do ISTQB Foundation Level Syllabus

