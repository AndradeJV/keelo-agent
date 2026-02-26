# Análise de Valor Limite (Boundary Value Analysis - BVA)

## Definição

Técnica de teste caixa-preta que foca nos valores nas fronteiras das partições de equivalência, onde erros tendem a se concentrar.

## Fundamento

Estudos mostram que a maioria dos defeitos ocorre nos limites das condições, não no meio das faixas válidas.

## Valores a Testar

Para cada limite, testar:

| Posição | Descrição | Exemplo (1-100) |
|---------|-----------|-----------------|
| **min-1** | Valor abaixo do mínimo | 0 |
| **min** | Valor mínimo válido | 1 |
| **min+1** | Valor logo acima do mínimo | 2 |
| **nom** | Valor nominal/típico | 50 |
| **max-1** | Valor logo abaixo do máximo | 99 |
| **max** | Valor máximo válido | 100 |
| **max+1** | Valor acima do máximo | 101 |

## Aplicação Prática

### Campos Numéricos
```
Campo: Idade (18-65 anos)
Testes: 17, 18, 19, 40, 64, 65, 66
```

### Campos de Texto
```
Campo: Nome (3-50 caracteres)
Testes: 2 chars, 3 chars, 4 chars, 25 chars, 49 chars, 50 chars, 51 chars
```

### Arrays/Listas
```
Lista: Máximo 10 itens
Testes: 0 itens, 1 item, 9 itens, 10 itens, 11 itens
```

### Datas
```
Campo: Data de nascimento (01/01/1900 - hoje)
Testes: 31/12/1899, 01/01/1900, 02/01/1900, ontem, hoje, amanhã
```

## Variações

### BVA de 2 valores
Testa apenas: min, max

### BVA de 3 valores  
Testa: min, nom, max

### BVA de 7 valores (Completo)
Testa: min-1, min, min+1, nom, max-1, max, max+1

## Quando Usar

- ✅ Campos com validação de range
- ✅ Paginação e limites de resultados
- ✅ Timeouts e delays
- ✅ Limites de upload (tamanho de arquivo)
- ✅ Limites de caracteres
- ✅ Quantidades em carrinho/pedidos

## Defeitos Típicos Detectados

- Off-by-one errors (usar < ao invés de <=)
- Overflow/underflow numérico
- Truncamento de dados
- Validações de frontend inconsistentes com backend

## Exemplo de Cenário

```gherkin
Funcionalidade: Cadastro de usuário com idade

Cenário: Idade no limite mínimo válido
  Dado que estou na página de cadastro
  Quando informo idade "18"
  Então o cadastro deve ser aceito

Cenário: Idade abaixo do limite mínimo
  Dado que estou na página de cadastro
  Quando informo idade "17"
  Então devo ver erro "Idade mínima é 18 anos"

Cenário: Idade no limite máximo válido
  Dado que estou na página de cadastro
  Quando informo idade "65"
  Então o cadastro deve ser aceito

Cenário: Idade acima do limite máximo
  Dado que estou na página de cadastro
  Quando informo idade "66"
  Então devo ver erro "Idade máxima é 65 anos"
```

## Referência ISTQB

Seção 4.2.1 do ISTQB Foundation Level Syllabus

