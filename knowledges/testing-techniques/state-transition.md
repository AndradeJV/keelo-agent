# Teste de Transição de Estado (State Transition Testing)

## Definição

Técnica de teste caixa-preta que modela o sistema como uma máquina de estados finitos, testando transições válidas e inválidas entre estados.

## Fundamento

Muitos sistemas têm comportamento que depende do estado atual e de eventos/ações. A transição de estado garante que todas as mudanças de estado sejam testadas corretamente.

## Componentes

1. **Estados** - Condições distintas do sistema
2. **Transições** - Mudanças de um estado para outro
3. **Eventos** - Gatilhos que causam transições
4. **Ações** - Operações executadas durante transições
5. **Guardas** - Condições para permitir transição

## Diagramas de Estado

### Exemplo: Pedido E-commerce

```
                    ┌─────────────┐
        criar       │             │
    ───────────────►│   CRIADO    │
                    │             │
                    └──────┬──────┘
                           │ pagar
                           ▼
                    ┌─────────────┐
        cancelar    │             │    pagamento
    ◄───────────────│    PAGO     │    falhou
    │               │             │────────────┐
    │               └──────┬──────┘            │
    │                      │ separar           │
    │                      ▼                   ▼
    │               ┌─────────────┐     ┌─────────────┐
    │               │             │     │             │
    │               │  SEPARANDO  │     │  CANCELADO  │
    │               │             │     │             │
    │               └──────┬──────┘     └─────────────┘
    │                      │ enviar            ▲
    │                      ▼                   │
    │               ┌─────────────┐            │
    │               │             │ problema   │
    └───────────────│   ENVIADO   │────────────┘
                    │             │
                    └──────┬──────┘
                           │ entregar
                           ▼
                    ┌─────────────┐
                    │             │
                    │  ENTREGUE   │
                    │             │
                    └─────────────┘
```

## Tabela de Transição de Estados

| Estado Atual | Evento | Guarda | Estado Destino | Ação |
|--------------|--------|--------|----------------|------|
| - | criar | - | CRIADO | Gerar número |
| CRIADO | pagar | pagamento ok | PAGO | Reservar estoque |
| CRIADO | cancelar | - | CANCELADO | - |
| PAGO | separar | estoque ok | SEPARANDO | Iniciar picking |
| PAGO | cancelar | - | CANCELADO | Estornar pagamento |
| SEPARANDO | enviar | - | ENVIADO | Gerar rastreio |
| ENVIADO | entregar | - | ENTREGUE | Notificar cliente |
| ENVIADO | problema | - | CANCELADO | Estornar + Notificar |

## Cobertura de Teste

### Nível 0: Cobertura de Estados
Visitar todos os estados pelo menos uma vez.

### Nível 1: Cobertura de Transições (0-switch)
Testar todas as transições válidas.

### Nível 2: Cobertura de Pares de Transições (1-switch)
Testar todas as sequências de 2 transições consecutivas.

### Nível N: Cobertura N-switch
Testar sequências de N+1 transições.

## Transições Inválidas

Testar eventos que **não deveriam** causar transição:

| Estado Atual | Evento Inválido | Comportamento Esperado |
|--------------|-----------------|------------------------|
| CRIADO | entregar | Erro: pedido não enviado |
| ENTREGUE | pagar | Erro: pedido já finalizado |
| CANCELADO | enviar | Erro: pedido cancelado |

## Exemplo de Cenários

```gherkin
Funcionalidade: Ciclo de vida do pedido

# Transição válida: CRIADO → PAGO
Cenário: Pagamento de pedido criado
  Dado que tenho um pedido no estado "CRIADO"
  Quando o pagamento é aprovado
  Então o pedido deve estar no estado "PAGO"
  E o estoque deve ser reservado

# Transição válida: PAGO → CANCELADO
Cenário: Cancelamento após pagamento
  Dado que tenho um pedido no estado "PAGO"
  Quando solicito o cancelamento
  Então o pedido deve estar no estado "CANCELADO"
  E o pagamento deve ser estornado

# Transição inválida
Cenário: Tentar entregar pedido não enviado
  Dado que tenho um pedido no estado "PAGO"
  Quando tento marcar como entregue
  Então devo ver erro "Pedido ainda não foi enviado"
  E o pedido deve permanecer no estado "PAGO"

# Sequência de transições (1-switch)
Cenário: Fluxo completo de pedido
  Dado que crio um novo pedido
  Quando o pagamento é aprovado
  E o pedido é separado
  E o pedido é enviado
  E o pedido é entregue
  Então o pedido deve estar no estado "ENTREGUE"
```

## Quando Usar

- ✅ Fluxos de workflow (pedidos, aprovações, tickets)
- ✅ Autenticação (sessões, tokens)
- ✅ Ciclo de vida de entidades
- ✅ Processos de pagamento
- ✅ Estados de UI (modais, wizards)
- ✅ Conexões de rede

## Defeitos Típicos Detectados

- Transições faltando
- Estados inalcançáveis
- Transições inválidas permitidas
- Ações não executadas
- Estados mortos (sem saída)
- Race conditions em transições concorrentes

## Referência ISTQB

Seção 4.2.4 do ISTQB Foundation Level Syllabus

