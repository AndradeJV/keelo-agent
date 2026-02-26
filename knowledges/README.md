# Keelo Knowledge Base

Base de conhecimento estruturada para fundamentar análises de QA e geração de cenários de teste.

## Estrutura

```
knowledges/
├── testing-techniques/     # Técnicas de design de teste
│   ├── boundary-value.md
│   ├── equivalence-partition.md
│   ├── decision-table.md
│   ├── state-transition.md
│   ├── pairwise.md
│   └── error-guessing.md
├── testing-types/          # Tipos e níveis de teste
│   ├── functional.md
│   ├── non-functional.md
│   ├── structural.md
│   └── change-related.md
├── heuristics/             # Heurísticas de qualidade
│   ├── nielsen-usability.md
│   ├── sfdpot.md
│   └── test-oracles.md
├── standards/              # Padrões e normas
│   ├── istqb/
│   ├── iso-25010.md
│   └── iso-29119.md
└── design-patterns/        # Padrões de design de teste
    ├── page-object-model.md
    ├── screenplay.md
    └── test-data-patterns.md
```

## Como Usar

Esta base de conhecimento é carregada automaticamente pelos prompts do Keelo para:

1. **Fundamentar análises** - Cada risco e cenário é baseado em técnicas reconhecidas
2. **Aplicar heurísticas** - Usar frameworks como SFDPOT e Nielsen para cobertura
3. **Seguir padrões** - Alinhamento com ISTQB, ISO 25010 e ISO 29119
4. **Gerar testes estruturados** - Aplicar técnicas de design de teste

## Referências

- ISTQB Foundation Level Syllabus v4.0
- ISO/IEC 25010:2011 - Systems and software Quality Requirements
- ISO/IEC 29119 - Software Testing Standards
- Nielsen's 10 Usability Heuristics
- James Bach's Heuristic Test Strategy Model

