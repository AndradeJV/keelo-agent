# Testes Relacionados a Mudanças

## Definição

Testes executados após modificações no sistema para garantir que as mudanças funcionam corretamente e não introduziram regressões.

## Tipos de Teste

### 1. Teste de Confirmação (Re-testing)

**Objetivo**: Verificar que um defeito reportado foi corrigido

**Processo**:
1. Reproduzir o defeito original (deve falhar antes da correção)
2. Aplicar a correção
3. Executar o mesmo teste (deve passar)
4. Documentar resultado

```gherkin
# Bug: BTG-1234 - Login falha com email em maiúsculas

Cenário: Login com email em maiúsculas (Re-test)
  Dado que existe usuário "USER@EXAMPLE.COM"
  Quando faço login com email "USER@EXAMPLE.COM"
  E senha correta
  Então devo acessar o sistema com sucesso
  # Antes: FALHOU - sistema diferenciava maiúsculas
  # Depois: PASSOU - correção aplicada
```

### 2. Teste de Regressão

**Objetivo**: Garantir que mudanças não quebraram funcionalidades existentes

#### Estratégias de Seleção

| Estratégia | Descrição | Quando Usar |
|------------|-----------|-------------|
| **Retest All** | Executar todos os testes | Release major, tempo disponível |
| **Risk-Based** | Priorizar por risco | Tempo limitado, análise de impacto |
| **Change-Based** | Testar áreas afetadas | Mudanças isoladas |
| **Random** | Amostragem aleatória | Complementar outras estratégias |

#### Análise de Impacto

```
Mudança: Alteração na função calculateTax()

Impacto Direto:
- [ ] Testes de calculateTax()
- [ ] Testes de checkout
- [ ] Testes de carrinho

Impacto Indireto:
- [ ] Testes de relatórios financeiros
- [ ] Testes de exportação de notas

Áreas Relacionadas:
- [ ] Testes de pagamento
- [ ] Testes de pedidos
```

#### Pirâmide de Testes de Regressão

```
         ╱╲
        ╱  ╲
       ╱ E2E╲          10% - Fluxos críticos
      ╱──────╲
     ╱        ╲
    ╱Integration╲      20% - Integrações chave
   ╱──────────────╲
  ╱                ╲
 ╱      Unit        ╲  70% - Cobertura ampla
╱────────────────────╲
```

### 3. Smoke Test (Teste de Fumaça)

**Objetivo**: Verificação rápida de sanidade após build/deploy

**Características**:
- Rápido (< 15 minutos)
- Automatizado
- Executa a cada deploy
- Bloqueia pipeline se falhar

```typescript
// smoke.spec.ts
test.describe('Smoke Test Suite', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/App Name/);
  });

  test('login works', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('API health check', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});
```

### 4. Sanity Test

**Objetivo**: Verificação focada após mudança específica

**Diferença do Smoke Test**:
- Smoke: Amplo e superficial
- Sanity: Profundo e focado

```
Mudança: Nova funcionalidade de exportar relatório em PDF

Sanity Test:
- [ ] Botão "Exportar PDF" visível
- [ ] Click gera arquivo PDF
- [ ] PDF contém dados corretos
- [ ] PDF formatado corretamente
- [ ] Funciona com relatórios grandes
- [ ] Funciona com relatórios vazios
```

## Automação de Regressão

### Critérios para Automação

| Prioridade | Característica |
|------------|----------------|
| Alta | Executado frequentemente |
| Alta | Crítico para negócio |
| Alta | Estável (não muda muito) |
| Média | Demorado para executar manualmente |
| Baixa | Difícil de reproduzir manualmente |
| Não automatizar | Muda constantemente |
| Não automatizar | Requer julgamento humano |

### Manutenção de Suite de Regressão

```
Práticas:
1. Revisar testes trimestralmente
2. Remover testes obsoletos
3. Atualizar testes com mudanças de requisito
4. Analisar testes flaky
5. Otimizar testes lentos
```

### Métricas de Regressão

| Métrica | Fórmula | Meta |
|---------|---------|------|
| Taxa de Regressão | Bugs regressão / Total bugs | < 10% |
| Eficiência de Detecção | Bugs encontrados em regressão / Bugs em produção | > 80% |
| Tempo de Execução | Tempo total da suite | < 2 horas |
| Taxa de Flaky | Testes instáveis / Total testes | < 5% |

## Integração Contínua

### Pipeline de Teste

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [push, pull_request]

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:smoke
    # Rápido, bloqueia merge se falhar

  unit:
    needs: smoke
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit
    # Paralelo com integration

  integration:
    needs: smoke
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:integration

  e2e:
    needs: [unit, integration]
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:e2e
    # Mais demorado, roda por último

  regression:
    needs: e2e
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:regression:full
    # Suite completa apenas em main
```

## Referência ISTQB

Capítulo 2.4 do ISTQB Foundation Level Syllabus

