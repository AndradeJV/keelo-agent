# Keelo Knowledge Base - Índice de Referência

## Base de Conhecimento para Análise de QA

Esta é a central de conhecimento que fundamenta todas as análises do Keelo. Use este material como referência para aplicar técnicas corretas e gerar cenários de teste de alta qualidade.

---

## 📚 Técnicas de Design de Teste

### Partição de Equivalência (Equivalence Partitioning)
- **Quando usar**: Campos com ranges de valores, validações de entrada
- **Como aplicar**: Dividir dados em partições válidas e inválidas, testar um representante de cada
- **Exemplo**: Campo idade 18-65 → P1(<18), P2(18-65), P3(>65), P4(não numérico)

### Análise de Valor Limite (Boundary Value Analysis)
- **Quando usar**: Limites de campos, paginação, quantidades
- **Como aplicar**: Testar min-1, min, min+1, nom, max-1, max, max+1
- **Exemplo**: Campo idade 18-65 → Testar: 17, 18, 19, 40, 64, 65, 66

### Tabela de Decisão (Decision Table)
- **Quando usar**: Regras de negócio complexas, múltiplas condições combinadas
- **Como aplicar**: Criar tabela com todas as combinações de condições e ações resultantes
- **Exemplo**: Desconto VIP + Valor + Frete → 8 combinações possíveis

### Transição de Estado (State Transition)
- **Quando usar**: Fluxos com estados definidos (pedidos, aprovações, tickets)
- **Como aplicar**: Mapear estados, transições válidas e inválidas
- **Exemplo**: Pedido: CRIADO → PAGO → SEPARANDO → ENVIADO → ENTREGUE

### Pairwise Testing (All-Pairs)
- **Quando usar**: Muitas combinações de configuração, compatibilidade
- **Como aplicar**: Garantir que cada par de valores seja testado pelo menos uma vez
- **Exemplo**: OS × Browser × Idioma → 9 testes cobrem todos os pares

### Error Guessing (Adivinhação de Erros)
- **Quando usar**: Complementar técnicas sistemáticas, teste exploratório
- **Como aplicar**: Usar catálogo de erros comuns (null, vazio, caracteres especiais, XSS, SQL injection)
- **Exemplo**: Campo nome → Testar: "", "   ", "<script>", "O'Connor"

---

## 🧪 Tipos e Níveis de Teste

### Níveis (ISTQB)
| Nível | Objetivo | Responsável |
|-------|----------|-------------|
| **Unitário** | Componentes isolados | Desenvolvedor |
| **Integração** | Interação entre módulos | Dev/QA |
| **Sistema (E2E)** | Fluxos end-to-end | QA |
| **Aceite** | Validação de negócio | PO/Usuário |

### Tipos Funcionais
- **Smoke Test**: Verificação rápida pós-deploy (< 15 min)
- **Sanity Test**: Verificação focada em mudança específica
- **Regressão**: Garantir que mudanças não quebraram funcionalidades
- **E2E**: Jornadas completas do usuário

### Tipos Não-Funcionais
- **Performance**: Load, Stress, Spike, Endurance
- **Segurança**: OWASP Top 10, autenticação, autorização
- **Usabilidade**: Heurísticas de Nielsen, SUS Score
- **Acessibilidade**: WCAG 2.1, navegação por teclado

---

## 🎯 Heurísticas de Qualidade

### 10 Heurísticas de Nielsen (Usabilidade)
1. **Visibilidade do status** - Feedback de loading, progresso
2. **Correspondência com mundo real** - Linguagem do usuário
3. **Controle e liberdade** - Desfazer, cancelar, voltar
4. **Consistência e padrões** - UI uniforme
5. **Prevenção de erros** - Validação antes de erro
6. **Reconhecimento vs lembrança** - Informações visíveis
7. **Flexibilidade e eficiência** - Atalhos para experts
8. **Design minimalista** - Sem informação irrelevante
9. **Recuperação de erros** - Mensagens claras e úteis
10. **Ajuda e documentação** - Tooltips, guias

### SFDPOT (Heurística de Teste)
- **S**tructure: Arquitetura, código, banco
- **F**unction: O que o sistema faz
- **D**ata: Entrada, saída, transformação
- **P**latform: Ambiente, browser, device
- **O**perations: Instalação, manutenção, logs
- **T**ime: Performance, timeouts, agendamentos

### Test Oracles (Como validar)
- Por especificação (requisitos)
- Por consistência (dados coerentes)
- Por comparação (sistema anterior)
- Estatístico (thresholds)
- Heurístico (bom senso)

---

## 📋 Padrões e Normas

### ISO/IEC 25010 - Qualidade de Produto
| Característica | Foco |
|----------------|------|
| Adequação Funcional | Completude, correção |
| Eficiência de Desempenho | Tempo, recursos, capacidade |
| Compatibilidade | Coexistência, interoperabilidade |
| Usabilidade | Aprendizibilidade, operabilidade |
| Confiabilidade | Disponibilidade, recuperabilidade |
| Segurança | Confidencialidade, integridade |
| Manutenibilidade | Modularidade, testabilidade |
| Portabilidade | Adaptabilidade, instalabilidade |

### ISO/IEC 29119 - Processos de Teste
- Política e estratégia de teste
- Planejamento e monitoramento
- Design e implementação
- Execução e reporte

### ISTQB Foundation
- 7 Princípios de teste
- Níveis e tipos de teste
- Técnicas de design
- Gestão de defeitos

---

## 🏗️ Padrões de Design de Teste

### Page Object Model (POM)
```typescript
// Separar páginas em classes
class LoginPage {
  readonly emailInput: Locator;
  async login(email, password): Promise<DashboardPage>
}
```

### Test Data Builder
```typescript
// Criar dados de teste fluentemente
const user = aUser().withName('João').asAdmin().build();
```

### Object Mother
```typescript
// Fábricas de objetos pré-configurados
const admin = TestUsers.admin();
const order = TestOrders.paidOrder(admin);
```

---

## 📊 Métricas de Qualidade

| Métrica | Meta Típica |
|---------|-------------|
| Cobertura de código | > 80% |
| Taxa de automação | > 70% |
| Densidade de defeitos | < 5/KLOC |
| Taxa de regressão | < 10% |
| Tempo de resposta P95 | < 500ms |
| Uptime | > 99.9% |

---

## 🔍 Checklist de Análise de Riscos

### Segurança
- [ ] SQL Injection possível?
- [ ] XSS possível?
- [ ] Dados sensíveis expostos?
- [ ] Autenticação/autorização verificada?
- [ ] HTTPS em todas as chamadas?

### Performance
- [ ] Queries N+1?
- [ ] Paginação implementada?
- [ ] Cache utilizado?
- [ ] Índices de banco?
- [ ] Lazy loading?

### Integridade de Dados
- [ ] Transações atômicas?
- [ ] Race conditions possíveis?
- [ ] Validação de entrada?
- [ ] Backup/rollback?

### UX
- [ ] Loading states?
- [ ] Mensagens de erro claras?
- [ ] Feedback de ações?
- [ ] Navegação intuitiva?
- [ ] Acessibilidade básica?

---

## 📝 Template de Cenário de Teste

```gherkin
Funcionalidade: [Nome da feature]

Cenário: [Título descritivo - happy_path|sad_path|edge_case]
  Dado [contexto inicial/precondição]
  E [contexto adicional se necessário]
  Quando [ação do usuário]
  E [ação adicional se necessário]
  Então [resultado esperado]
  E [verificação adicional]

# Metadados:
# Prioridade: critical|high|medium|low
# Técnica: equivalence_partitioning|boundary_value|state_transition|decision_table|error_guessing
# Tipo: unit|integration|e2e|api
# Riscos cobertos: [lista de riscos mitigados]
```

