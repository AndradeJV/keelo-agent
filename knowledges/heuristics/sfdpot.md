# SFDPOT - San Francisco Depot Heuristic

## Introdução

SFDPOT (também chamado de "San Francisco Depot") é uma mnemônica criada por James Bach para o Heuristic Test Strategy Model. Ajuda testadores a explorar diferentes dimensões de qualidade de um produto.

## As Dimensões

### S - Structure (Estrutura)

**O que é**: A composição física e lógica do produto - código, arquivos, banco de dados, arquitetura.

**Perguntas Guia**:
- Como os componentes estão organizados?
- Quais são as dependências?
- O código é modular?
- A estrutura de dados está otimizada?

**Cenários de Teste**:
```gherkin
Cenário: Integridade da estrutura de banco
  Dado que o sistema está em uso
  Quando verifico as tabelas do banco
  Então todas as foreign keys devem ser válidas
  E não deve haver registros órfãos

Cenário: Estrutura de arquivos de configuração
  Dado que faço deploy do sistema
  Quando verifico os arquivos de config
  Então todos os arquivos obrigatórios devem existir
  E devem estar em formato válido (JSON/YAML)
```

**Riscos Típicos**:
- Dependências circulares
- Código duplicado
- Schema de banco inconsistente
- Arquivos de configuração corrompidos

---

### F - Function (Função)

**O que é**: O que o produto faz - funcionalidades, cálculos, transformações de dados.

**Perguntas Guia**:
- O produto faz o que deveria?
- As regras de negócio estão corretas?
- Os cálculos são precisos?
- Os fluxos funcionam end-to-end?

**Cenários de Teste**:
```gherkin
Cenário: Cálculo de desconto funciona
  Dado que sou cliente VIP
  E tenho R$ 500 no carrinho
  Quando aplico cupom "DESCONTO20"
  Então o total deve ser R$ 400

Cenário: Fluxo de pedido completo
  Dado que adiciono produtos ao carrinho
  E informo endereço de entrega
  E seleciono forma de pagamento
  Quando confirmo o pedido
  Então o pedido deve ser criado
  E o pagamento deve ser processado
  E devo receber confirmação por email
```

**Riscos Típicos**:
- Regras de negócio mal implementadas
- Cálculos incorretos
- Fluxos incompletos
- Estados inconsistentes

---

### D - Data (Dados)

**O que é**: Os dados que o produto processa - entrada, saída, armazenamento, transformação.

**Perguntas Guia**:
- Que tipos de dados são aceitos?
- Como os dados são validados?
- Os dados são persistidos corretamente?
- A transformação de dados é precisa?

**Cenários de Teste**:
```gherkin
Cenário: Validação de email
  Dado que informo email "usuario@"
  Quando tento salvar
  Então devo ver erro de validação

Cenário: Persistência de dados complexos
  Dado que salvo um documento com caracteres especiais "çãé中文"
  Quando recarrego o documento
  Então os caracteres devem estar corretos

Cenário: Dados em massa
  Dado que importo arquivo com 100.000 registros
  Quando o import completa
  Então todos os registros devem estar no banco
```

**Riscos Típicos**:
- Encoding incorreto (UTF-8)
- Truncamento de dados
- Perda de precisão numérica
- Validação insuficiente
- SQL injection

---

### P - Platform (Plataforma)

**O que é**: O ambiente onde o produto roda - OS, navegador, hardware, serviços externos.

**Perguntas Guia**:
- Funciona em todos os navegadores?
- Funciona em diferentes resoluções?
- Funciona offline?
- As integrações externas são resilientes?

**Cenários de Teste**:
```gherkin
Cenário: Compatibilidade mobile
  Dado que acesso em iPhone Safari
  Quando navego pelo sistema
  Então todas as funcionalidades devem funcionar
  E o layout deve estar responsivo

Cenário: Resiliência a falha de API externa
  Dado que a API de CEP está fora do ar
  Quando tento consultar CEP
  Então devo ver mensagem amigável
  E o sistema deve continuar funcionando

Cenário: Performance em hardware limitado
  Dado que acesso em computador com 4GB RAM
  Quando uso o sistema por 1 hora
  Então não deve haver degradação de performance
```

**Riscos Típicos**:
- Incompatibilidade de navegador
- Layout quebrado em mobile
- Dependência de serviço externo
- Memory leaks

---

### O - Operations (Operações)

**O que é**: Como o produto é usado no dia-a-dia - instalação, configuração, manutenção, monitoramento.

**Perguntas Guia**:
- A instalação é simples?
- A configuração é flexível?
- Os logs são úteis?
- O backup/restore funciona?

**Cenários de Teste**:
```gherkin
Cenário: Instalação do zero
  Dado que tenho uma máquina limpa
  Quando sigo a documentação de instalação
  Então o sistema deve estar funcional em menos de 30 minutos

Cenário: Restore de backup
  Dado que tenho backup de ontem
  Quando faço restore do banco de dados
  Então todos os dados devem estar corretos
  E o sistema deve funcionar normalmente

Cenário: Logs para debugging
  Dado que ocorre um erro 500
  Quando verifico os logs
  Então devo encontrar stacktrace completo
  E devo encontrar contexto (user, request)
```

**Riscos Típicos**:
- Instalação complexa
- Configuração hardcoded
- Logs insuficientes
- Sem monitoramento
- Backup inconsistente

---

### T - Time (Tempo)

**O que é**: Aspectos temporais - performance, timeouts, agendamentos, estados ao longo do tempo.

**Perguntas Guia**:
- O sistema é rápido o suficiente?
- Os timeouts são adequados?
- Jobs agendados funcionam?
- O sistema degrada com o tempo?

**Cenários de Teste**:
```gherkin
Cenário: Tempo de resposta aceitável
  Dado que faço uma busca comum
  Quando aguardo resultado
  Então deve retornar em menos de 2 segundos

Cenário: Timeout de sessão
  Dado que estou logado
  Quando fico inativo por 30 minutos
  Então devo ser deslogado automaticamente
  E ao tentar ação devo ser redirecionado para login

Cenário: Job agendado executa corretamente
  Dado que tenho job de limpeza às 3h
  Quando chega 3h da manhã
  Então o job deve executar
  E logs antigos devem ser removidos
```

**Riscos Típicos**:
- Lentidão em operações
- Race conditions
- Timeouts muito curtos/longos
- Jobs falhando silenciosamente
- Memory leak ao longo do tempo

---

## Aplicando SFDPOT em Análise de Requisitos

### Checklist de Análise

Para cada funcionalidade, pergunte:

| Dimensão | Pergunta Chave |
|----------|----------------|
| **S**tructure | Como isso afeta a arquitetura? |
| **F**unction | O que exatamente deve fazer? |
| **D**ata | Que dados são envolvidos? |
| **P**latform | Onde deve funcionar? |
| **O**perations | Como será operado/mantido? |
| **T**ime | Há requisitos de tempo/performance? |

### Exemplo: Nova Funcionalidade "Exportar Relatório PDF"

| Dimensão | Análise | Cenários de Teste |
|----------|---------|-------------------|
| Structure | Novo módulo de geração de PDF | Teste de integração com módulo |
| Function | Gerar PDF com dados do relatório | Relatório vazio, cheio, formatação |
| Data | Dados do relatório, template PDF | Unicode, imagens, tabelas grandes |
| Platform | Todos os navegadores, download funciona | Chrome, Firefox, Safari, mobile |
| Operations | Logs de geração, timeout configurável | Monitoramento, configuração |
| Time | Gerar em < 30s, não travar UI | Performance com dados grandes |

## Referência

James Bach - Heuristic Test Strategy Model
https://www.satisfice.com/download/heuristic-test-strategy-model

