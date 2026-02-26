# ISTQB Foundation Level - Syllabus Resumido

## Introdução

O ISTQB (International Software Testing Qualifications Board) é o padrão internacional para certificação em testes de software. Este documento resume os conceitos fundamentais do Foundation Level Syllabus v4.0.

## Capítulo 1: Fundamentos de Teste

### 1.1 O que é Teste?

**Definição**: Teste de software é um processo que inclui todas as atividades do ciclo de vida, tanto estáticas quanto dinâmicas, relacionadas à avaliação da qualidade de um produto.

**Objetivos do Teste**:
- Avaliar produtos de trabalho (requisitos, código, design)
- Verificar se requisitos foram atendidos
- Validar se o objeto de teste está completo
- Construir confiança no nível de qualidade
- Encontrar defeitos
- Fornecer informações para tomada de decisão
- Prevenir defeitos

### 1.2 Por que Teste é Necessário?

**Custo do Defeito**:
| Fase de Detecção | Custo Relativo |
|------------------|----------------|
| Requisitos | 1x |
| Design | 5x |
| Codificação | 10x |
| Teste | 20x |
| Produção | 100x |

**Causas de Defeitos**:
- Erro humano (mistake)
- Pressão de prazo
- Complexidade do código
- Mudanças de requisitos
- Comunicação falha

### 1.3 Princípios de Teste

| # | Princípio | Descrição |
|---|-----------|-----------|
| 1 | Teste mostra presença de defeitos | Teste pode mostrar que defeitos existem, mas não pode provar que não existem |
| 2 | Teste exaustivo é impossível | Testar todas as combinações é inviável; usar análise de risco |
| 3 | Teste antecipado economiza | Começar testes cedo no ciclo de vida |
| 4 | Agrupamento de defeitos | Defeitos tendem a se concentrar em poucos módulos |
| 5 | Paradoxo do pesticida | Repetir mesmos testes não encontra novos defeitos |
| 6 | Teste depende do contexto | Abordagem varia conforme o produto |
| 7 | Ausência de erros é falácia | Software livre de defeitos pode ser inútil se não atender necessidades |

### 1.4 Atividades de Teste

**Processo de Teste**:
1. **Planejamento** - Definir objetivos, abordagem, recursos
2. **Análise** - "O que testar?" - Analisar base de teste
3. **Design** - "Como testar?" - Criar casos de teste
4. **Implementação** - Preparar testware
5. **Execução** - Rodar testes, comparar resultados
6. **Conclusão** - Avaliar critérios de saída, reportar

---

## Capítulo 2: Teste ao Longo do Ciclo de Vida

### 2.1 Modelos de Desenvolvimento

**Modelo V**:
```
Requisitos ────────────────────────────── Teste de Aceite
    ↓                                           ↑
    Design de Sistema ─────────────── Teste de Sistema
        ↓                                   ↑
        Design Detalhado ─────── Teste de Integração
            ↓                         ↑
            Codificação ───── Teste Unitário
```

**Desenvolvimento Iterativo/Ágil**:
- Testes integrados em cada iteração
- Automação essencial
- Testes contínuos

### 2.2 Níveis de Teste

| Nível | Objetivo | Base de Teste | Responsável |
|-------|----------|---------------|-------------|
| Unitário | Componentes isolados | Código, design detalhado | Desenvolvedor |
| Integração | Interação entre componentes | Design de sistema, APIs | Desenvolvedor/QA |
| Sistema | Sistema completo | Requisitos, casos de uso | QA |
| Aceite | Validar para o negócio | Requisitos de negócio, regulatórios | Usuário/PO |

### 2.3 Tipos de Teste

**Funcionais**: O que o sistema faz
**Não-Funcionais**: Como o sistema funciona (performance, segurança, usabilidade)
**Caixa-Branca**: Baseado na estrutura interna
**Relacionados a Mudanças**: Confirmação e regressão

---

## Capítulo 3: Teste Estático

### 3.1 Técnicas Estáticas

Análise do produto **sem executar** o código.

**Revisões**:
| Tipo | Formalidade | Participantes |
|------|-------------|---------------|
| Informal | Baixa | Par de desenvolvedores |
| Walkthrough | Média | Autor + grupo |
| Revisão Técnica | Alta | Especialistas |
| Inspeção | Muito alta | Processo formal com métricas |

**Análise Estática**:
- Ferramentas de lint
- Análise de complexidade
- Verificação de padrões
- Análise de fluxo de dados

---

## Capítulo 4: Técnicas de Teste

### 4.1 Categorias de Técnicas

**Caixa-Preta (Black-box)**:
- Partição de Equivalência
- Análise de Valor Limite
- Tabela de Decisão
- Transição de Estado
- Casos de Uso

**Caixa-Branca (White-box)**:
- Cobertura de Declaração
- Cobertura de Decisão
- Cobertura de Condição

**Baseadas em Experiência**:
- Error Guessing
- Teste Exploratório
- Teste baseado em Checklist

### 4.2 Aplicação das Técnicas

| Técnica | Quando Usar |
|---------|-------------|
| Equivalência | Campos com ranges de valores |
| Valor Limite | Limites de campos/listas |
| Tabela Decisão | Regras de negócio complexas |
| Transição Estado | Fluxos com estados definidos |
| Cobertura | Código crítico, algoritmos |
| Exploratório | Pouca documentação, agilidade |

---

## Capítulo 5: Gerenciamento de Teste

### 5.1 Organização de Teste

**Níveis de Independência**:
1. Sem independência (dev testa próprio código)
2. Desenvolvedor testa código de colega
3. Testador na equipe de desenvolvimento
4. Equipe de teste independente
5. Organização de teste externa

### 5.2 Planejamento de Teste

**Plano de Teste contém**:
- Escopo e objetivos
- Critérios de entrada/saída
- Cronograma e recursos
- Riscos e contingências
- Métricas a coletar

### 5.3 Estimativa de Teste

**Técnicas**:
- Baseada em métricas (histórico)
- Baseada em especialistas
- Wideband Delphi
- Três pontos (otimista, provável, pessimista)

### 5.4 Monitoramento e Controle

**Métricas Comuns**:
| Métrica | Fórmula |
|---------|---------|
| Progresso | Testes executados / Total planejado |
| Taxa de Defeitos | Defeitos encontrados / Esforço |
| Densidade de Defeitos | Defeitos / KLOC |
| Cobertura de Requisitos | Requisitos cobertos / Total |

### 5.5 Gestão de Defeitos

**Ciclo de Vida do Defeito**:
```
Novo → Aberto → Em Análise → Em Correção → Corrigido → Verificado → Fechado
                    ↓                                        ↓
                Rejeitado                                Reaberto
```

**Relatório de Defeito contém**:
- ID único
- Título descritivo
- Passos para reproduzir
- Resultado esperado vs obtido
- Severidade e prioridade
- Ambiente
- Evidências (screenshots, logs)

---

## Capítulo 6: Ferramentas de Teste

### 6.1 Tipos de Ferramentas

| Categoria | Exemplos |
|-----------|----------|
| Gerenciamento | Jira, TestRail, Zephyr |
| Automação de Teste | Playwright, Cypress, Selenium |
| Performance | k6, JMeter, Gatling |
| Cobertura | Istanbul, Cobertura, JaCoCo |
| Análise Estática | ESLint, SonarQube, TSLint |
| CI/CD | GitHub Actions, Jenkins, GitLab CI |

### 6.2 Automação de Teste

**Benefícios**:
- Execução rápida e repetível
- Regressão consistente
- Liberação de tempo para testes exploratórios

**Riscos**:
- Custo inicial alto
- Manutenção de scripts
- Falsos positivos/negativos
- Expectativas irreais

**Pirâmide de Automação**:
```
         ╱╲
        ╱E2E╲         Poucos, lentos, caros
       ╱──────╲
      ╱ API/   ╲      Moderados
     ╱Integration╲
    ╱──────────────╲
   ╱     Unit       ╲ Muitos, rápidos, baratos
  ╱──────────────────╲
```

---

## Glossário de Termos ISTQB

| Termo | Definição |
|-------|-----------|
| **Defeito (Defect)** | Imperfeição no produto que pode causar falha |
| **Erro (Error)** | Ação humana que produz resultado incorreto |
| **Falha (Failure)** | Desvio do comportamento esperado em execução |
| **Caso de Teste** | Conjunto de entradas, pré-condições, resultados esperados |
| **Suite de Teste** | Conjunto de casos de teste relacionados |
| **Cobertura** | Grau em que um item foi exercitado por testes |
| **Regressão** | Teste para verificar que mudanças não quebraram funcionalidades |
| **Testware** | Artefatos produzidos durante o processo de teste |

---

## Referência

ISTQB Foundation Level Syllabus v4.0 (2023)
https://www.istqb.org/certifications/certified-tester-foundation-level

