# Testes Estruturais (Caixa Branca)

## Definição

Testes baseados na estrutura interna do código, examinando caminhos de execução, condições e fluxo de dados. Também chamados de testes de caixa branca ou caixa de vidro.

## Técnicas de Cobertura

### 1. Cobertura de Declaração (Statement Coverage)

**Objetivo**: Executar cada linha de código pelo menos uma vez
**Mínimo Aceitável**: 80%

```javascript
// Código
function calculatePrice(quantity, unitPrice, isVip) {
  let total = quantity * unitPrice;         // Linha 1
  if (isVip) {                               // Linha 2
    total = total * 0.9;                     // Linha 3
  }
  return total;                              // Linha 4
}

// Teste para 100% statement coverage
test('non-VIP customer', () => {
  expect(calculatePrice(10, 100, false)).toBe(1000); // Cobre linhas 1, 2, 4
});

test('VIP customer', () => {
  expect(calculatePrice(10, 100, true)).toBe(900);   // Cobre linha 3
});
```

### 2. Cobertura de Decisão (Decision/Branch Coverage)

**Objetivo**: Executar cada decisão (if/else, switch) em ambas as direções
**Mínimo Aceitável**: 80%

```javascript
// Código com decisão
function getShipping(total, isPrime) {
  if (total > 100 || isPrime) {  // Decisão com 2 condições
    return 0;                     // Branch: true
  }
  return 15;                      // Branch: false
}

// Testes para 100% branch coverage
test('total > 100, not prime', () => {
  expect(getShipping(150, false)).toBe(0);  // true branch
});

test('total < 100, not prime', () => {
  expect(getShipping(50, false)).toBe(15);  // false branch
});
```

### 3. Cobertura de Condição (Condition Coverage)

**Objetivo**: Testar cada condição atômica como true e false

```javascript
// Código: if (A || B)
// Condições: A e B

// Testes para 100% condition coverage
// A=true, B=false  → resultado true
// A=false, B=true  → resultado true
// A=false, B=false → resultado false (opcional para branch)

test('A true, B false', () => {
  expect(getShipping(150, false)).toBe(0);  // A=true
});

test('A false, B true', () => {
  expect(getShipping(50, true)).toBe(0);    // B=true
});

test('A false, B false', () => {
  expect(getShipping(50, false)).toBe(15);  // ambos false
});
```

### 4. Cobertura MC/DC (Modified Condition/Decision Coverage)

**Objetivo**: Mostrar que cada condição afeta independentemente a decisão
**Uso**: Sistemas críticos (aviação, medicina)

```
Condição: A || B

| Caso | A | B | Resultado | Mostra independência de |
|------|---|---|-----------|-------------------------|
| 1    | T | F | T         | A (comparar com 3)      |
| 2    | F | T | T         | B (comparar com 3)      |
| 3    | F | F | F         | Base                    |

Mínimo: 3 casos (N+1 para N condições)
```

### 5. Cobertura de Caminho (Path Coverage)

**Objetivo**: Testar todos os caminhos possíveis através do código
**Limitação**: Exponencial em código com loops/decisões

```javascript
// Código com múltiplos caminhos
function processOrder(order) {
  if (order.isValid) {           // Decisão 1
    if (order.hasStock) {        // Decisão 2
      ship(order);               // Caminho 1: valid + stock
    } else {
      backorder(order);          // Caminho 2: valid + no stock
    }
  } else {
    reject(order);               // Caminho 3: invalid
  }
}

// Caminhos: 3 (2^2 - 1 impossível)
```

## Complexidade Ciclomática

**Fórmula**: M = E - N + 2P
- E = arestas do grafo de fluxo
- N = nós do grafo
- P = componentes conectados (geralmente 1)

**Interpretação**:

| Complexidade | Risco | Testabilidade |
|--------------|-------|---------------|
| 1-10 | Baixo | Fácil |
| 11-20 | Moderado | Moderada |
| 21-50 | Alto | Difícil |
| > 50 | Muito alto | Quase impossível |

**Cálculo Simplificado**:
M = número de decisões + 1

```javascript
function example(a, b, c) {
  if (a) { ... }        // +1
  if (b) { ... }        // +1
  while (c) { ... }     // +1
  // Complexidade = 3 + 1 = 4
}
```

## Testes Baseados em Fluxo de Dados

### Definição-Uso (Def-Use)

Testar caminhos entre onde uma variável é definida e onde é usada.

```javascript
function process(items) {
  let total = 0;                    // DEF: total
  for (const item of items) {
    total += item.price;            // USE: total, DEF: total
  }
  return applyTax(total);           // USE: total
}

// Testes devem cobrir:
// - DEF em linha 2 → USE em linha 4
// - DEF em linha 4 → USE em linha 4 (loop)
// - DEF em linha 4 → USE em linha 6
```

## Ferramentas de Cobertura

### JavaScript/TypeScript

```json
// vitest.config.ts
{
  "test": {
    "coverage": {
      "provider": "v8",
      "reporter": ["text", "html", "lcov"],
      "thresholds": {
        "statements": 80,
        "branches": 80,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

### Relatório de Cobertura

```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   85.71 |    83.33 |   90.00 |   85.71 |
 src/               |         |          |         |         |
  calculator.ts     |   100   |    100   |   100   |   100   |
  order.ts          |   75.00 |    66.67 |   80.00 |   75.00 |
--------------------|---------|----------|---------|---------|
```

## Quando Usar

- ✅ Testes unitários
- ✅ Código crítico de negócio
- ✅ Algoritmos complexos
- ✅ Validação de correção de bugs
- ✅ Code review guiado por cobertura

## Limitações

- ⚠️ 100% cobertura ≠ 100% qualidade
- ⚠️ Não garante teste de valores corretos
- ⚠️ Código morto pode inflar cobertura
- ⚠️ Complexidade em código assíncrono

## Referência ISTQB

Capítulo 4.3 do ISTQB Foundation Level Syllabus

