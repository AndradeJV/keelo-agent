# Partição de Equivalência (Equivalence Partitioning - EP)

## Definição

Técnica de teste caixa-preta que divide os dados de entrada em grupos (partições) onde todos os membros devem ser tratados de forma equivalente pelo sistema.

## Fundamento

Se um valor de uma partição funciona, todos os outros valores da mesma partição também devem funcionar. Isso permite reduzir o número de casos de teste sem perder cobertura.

## Tipos de Partições

### Partições Válidas
Valores que o sistema deve aceitar e processar corretamente.

### Partições Inválidas
Valores que o sistema deve rejeitar com tratamento de erro apropriado.

## Aplicação Prática

### Campo: Idade para Seguro (18-65)

| Partição | Tipo | Valores | Representante |
|----------|------|---------|---------------|
| P1 | Inválida | < 18 | 15 |
| P2 | Válida | 18-65 | 35 |
| P3 | Inválida | > 65 | 70 |
| P4 | Inválida | Não numérico | "abc" |
| P5 | Inválida | Vazio | "" |
| P6 | Inválida | Negativo | -5 |

### Campo: Email

| Partição | Tipo | Exemplo |
|----------|------|---------|
| P1 | Válida | usuario@dominio.com |
| P2 | Inválida - sem @ | usuariodominio.com |
| P3 | Inválida - sem domínio | usuario@ |
| P4 | Inválida - sem usuário | @dominio.com |
| P5 | Inválida - espaços | user name@domain.com |
| P6 | Inválida - caracteres especiais | user<>@domain.com |
| P7 | Válida - subdomínio | user@mail.domain.com |
| P8 | Válida - domínio longo | user@domain.co.uk |

### Campo: Método de Pagamento

| Partição | Tipo | Valor |
|----------|------|-------|
| P1 | Válida | Cartão de crédito |
| P2 | Válida | Cartão de débito |
| P3 | Válida | PIX |
| P4 | Válida | Boleto |
| P5 | Inválida | Criptomoeda (não suportado) |

## Regras de Aplicação

1. **Identificar entradas** - Listar todos os campos/parâmetros
2. **Definir partições** - Para cada entrada, criar partições válidas e inválidas
3. **Escolher representante** - Selecionar um valor de cada partição
4. **Criar casos de teste** - Cobrir todas as partições

## Cobertura Mínima

- **Cobertura de partições válidas**: Cada partição válida aparece em pelo menos um caso de teste
- **Cobertura de partições inválidas**: Cada partição inválida aparece em um caso de teste isolado (não misturar inválidas)

## Combinação com BVA

EP e BVA são complementares:
- EP identifica as partições
- BVA testa os limites entre partições

```
Idade: 18-65

EP: [<18] [18-65] [>65]
     ↑      ↑       ↑
    P1     P2      P3

BVA nos limites:
     17|18|19 ... 64|65|66
```

## Exemplo de Cenário

```gherkin
Funcionalidade: Login com validação de email

# Partição válida
Cenário: Login com email válido
  Dado que estou na página de login
  Quando informo email "usuario@empresa.com"
  E informo senha válida
  Então devo acessar o sistema

# Partição inválida - sem @
Cenário: Email sem arroba
  Dado que estou na página de login
  Quando informo email "usuarioempresa.com"
  Então devo ver erro "Email inválido"

# Partição inválida - vazio
Cenário: Email vazio
  Dado que estou na página de login
  Quando deixo o campo email vazio
  Então devo ver erro "Email é obrigatório"
```

## Defeitos Típicos Detectados

- Validações faltando para tipos específicos de entrada
- Tratamento inconsistente entre partições
- Mensagens de erro genéricas ou ausentes
- Lógica de negócio incorreta para casos específicos

## Referência ISTQB

Seção 4.2.1 do ISTQB Foundation Level Syllabus

