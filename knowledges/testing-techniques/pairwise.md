# Teste Pairwise (All-Pairs Testing)

## Definição

Técnica combinatória que garante que cada par de valores de parâmetros seja testado pelo menos uma vez, reduzindo drasticamente o número de casos de teste sem perder cobertura significativa.

## Fundamento

Estudos mostram que a maioria dos defeitos é causada pela interação de no máximo 2 fatores. Testar todos os pares cobre a grande maioria dos defeitos com muito menos testes que a combinação exaustiva.

## Redução de Casos de Teste

| Parâmetros | Valores cada | Exaustivo | Pairwise | Redução |
|------------|--------------|-----------|----------|---------|
| 3 | 3 | 27 | 9 | 67% |
| 4 | 3 | 81 | 9 | 89% |
| 5 | 4 | 1024 | 16 | 98% |
| 10 | 3 | 59.049 | 15 | 99.97% |

## Exemplo Prático: Configuração de Ambiente

### Parâmetros

| Parâmetro | Valores |
|-----------|---------|
| Sistema Operacional | Windows, macOS, Linux |
| Navegador | Chrome, Firefox, Safari |
| Idioma | PT, EN, ES |
| Resolução | Desktop, Tablet, Mobile |

### Combinação Exaustiva
3 × 3 × 3 × 3 = **81 testes**

### Pairwise (Exemplo)

| # | SO | Navegador | Idioma | Resolução |
|---|-----|-----------|--------|-----------|
| 1 | Windows | Chrome | PT | Desktop |
| 2 | Windows | Firefox | EN | Tablet |
| 3 | Windows | Safari | ES | Mobile |
| 4 | macOS | Chrome | EN | Mobile |
| 5 | macOS | Firefox | ES | Desktop |
| 6 | macOS | Safari | PT | Tablet |
| 7 | Linux | Chrome | ES | Tablet |
| 8 | Linux | Firefox | PT | Mobile |
| 9 | Linux | Safari | EN | Desktop |

**9 testes** cobrem todos os pares possíveis!

### Verificação de Cobertura

Exemplos de pares cobertos:
- (Windows, Chrome) ✓ Teste 1
- (Windows, Firefox) ✓ Teste 2
- (Chrome, PT) ✓ Teste 1
- (Chrome, EN) ✓ Teste 4
- (Mobile, ES) ✓ Teste 3
- (Linux, Desktop) ✓ Teste 9

## Ferramentas

### PICT (Microsoft)
```
# pairwise.txt
OS: Windows, macOS, Linux
Browser: Chrome, Firefox, Safari
Language: PT, EN, ES
Resolution: Desktop, Tablet, Mobile

# Executar:
pict pairwise.txt
```

### AllPairs (satisfice.com)
Ferramenta online/CLI para gerar combinações.

### Geração Manual
Para poucos parâmetros, usar tabela ortogonal ou Latin Square.

## Exemplo de Cenários

```gherkin
Funcionalidade: Compatibilidade cross-platform

Cenário: Windows + Chrome + PT + Desktop
  Dado que acesso o sistema em Windows com Chrome
  E o idioma está configurado para PT
  E a resolução é Desktop
  Quando navego pelas funcionalidades principais
  Então todas devem funcionar corretamente

Cenário: macOS + Safari + EN + Tablet  
  Dado que acesso o sistema em macOS com Safari
  E o idioma está configurado para EN
  E a resolução é Tablet
  Quando navego pelas funcionalidades principais
  Então todas devem funcionar corretamente

# Esquema de cenário para automação
Esquema do Cenário: Compatibilidade multi-ambiente
  Dado que acesso o sistema em <so> com <navegador>
  E o idioma está configurado para <idioma>
  E a resolução é <resolucao>
  Quando navego pelas funcionalidades principais
  Então todas devem funcionar corretamente

  Exemplos:
    | so      | navegador | idioma | resolucao |
    | Windows | Chrome    | PT     | Desktop   |
    | Windows | Firefox   | EN     | Tablet    |
    | Windows | Safari    | ES     | Mobile    |
    | macOS   | Chrome    | EN     | Mobile    |
    | macOS   | Firefox   | ES     | Desktop   |
    | macOS   | Safari    | PT     | Tablet    |
    | Linux   | Chrome    | ES     | Tablet    |
    | Linux   | Firefox   | PT     | Mobile    |
    | Linux   | Safari    | EN     | Desktop   |
```

## Quando Usar

- ✅ Testes de compatibilidade (OS, browser, device)
- ✅ Configurações com muitos parâmetros
- ✅ APIs com múltiplos query parameters
- ✅ Formulários complexos
- ✅ Feature flags combinadas
- ✅ Testes de integração multi-sistema

## Limitações

- ⚠️ Não cobre interações de 3+ fatores
- ⚠️ Alguns pares críticos podem precisar de teste dedicado
- ⚠️ Não substitui testes de limites (BVA)

## Extensões

### 3-wise (Triplas)
Cobre todas as combinações de 3 valores. Mais testes, mais cobertura.

### N-wise
Generalização para N fatores. Aumenta exponencialmente.

## Referência ISTQB

Seção 4.2.5 do ISTQB Foundation Level Syllabus (Técnicas combinatórias)

