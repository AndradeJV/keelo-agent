# Testes Funcionais

## Definição

Testes que verificam **o que** o sistema faz, validando funcionalidades contra requisitos e especificações. Foco no comportamento externo, sem considerar a implementação interna.

## Níveis de Teste Funcional

### 1. Teste de Componente (Unitário)

**Escopo**: Funções, métodos, classes isoladas
**Objetivo**: Verificar comportamento de unidades individuais
**Responsável**: Desenvolvedor

```typescript
// Exemplo: Teste unitário de função de cálculo
describe('calculateDiscount', () => {
  it('should apply 10% discount for orders above 100', () => {
    expect(calculateDiscount(150)).toBe(135);
  });
  
  it('should not apply discount for orders below 100', () => {
    expect(calculateDiscount(80)).toBe(80);
  });
});
```

### 2. Teste de Integração

**Escopo**: Interação entre componentes/módulos
**Objetivo**: Verificar comunicação e fluxo de dados
**Responsável**: Desenvolvedor/QA

```typescript
// Exemplo: Teste de integração API + Banco
describe('UserService', () => {
  it('should create user and save to database', async () => {
    const user = await userService.create({ name: 'Test', email: 'test@test.com' });
    const saved = await database.users.findById(user.id);
    expect(saved.email).toBe('test@test.com');
  });
});
```

### 3. Teste de Sistema (E2E)

**Escopo**: Sistema completo, fluxo do usuário
**Objetivo**: Verificar comportamento end-to-end
**Responsável**: QA

```typescript
// Exemplo: Teste E2E com Playwright
test('user can complete purchase', async ({ page }) => {
  await page.goto('/products');
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="checkout"]');
  await page.fill('[name="card"]', '4111111111111111');
  await page.click('[data-testid="pay"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

### 4. Teste de Aceite

**Escopo**: Requisitos de negócio e usuário
**Objetivo**: Validar que o sistema atende necessidades
**Responsável**: PO/Usuário/QA

```gherkin
# Exemplo: Teste de aceite BDD
Funcionalidade: Checkout com cupom de desconto

Cenário: Aplicar cupom válido
  Dado que tenho produtos no carrinho totalizando R$ 200
  Quando aplico o cupom "DESCONTO10"
  Então o total deve ser R$ 180
  E devo ver mensagem "Cupom aplicado com sucesso"
```

## Tipos de Teste Funcional

### Teste de Fumaça (Smoke Test)

**Objetivo**: Verificar funções críticas após build/deploy
**Cobertura**: Mínima, apenas fluxos principais
**Duração**: Rápida (minutos)

```
Checklist Smoke Test:
- [ ] Página inicial carrega
- [ ] Login funciona
- [ ] Página principal após login carrega
- [ ] Uma operação CRUD funciona
- [ ] Logout funciona
```

### Teste de Sanidade (Sanity Test)

**Objetivo**: Verificar correção de bug ou nova funcionalidade específica
**Cobertura**: Focada na mudança
**Duração**: Rápida

### Teste de Regressão

**Objetivo**: Garantir que mudanças não quebraram funcionalidades existentes
**Cobertura**: Ampla, funcionalidades críticas
**Duração**: Longa (automatizada)

```
Estratégia de Regressão:
1. Casos de teste de alta prioridade (sempre)
2. Casos de teste de áreas afetadas (análise de impacto)
3. Testes aleatórios de outras áreas (amostragem)
```

### Teste de Ponta a Ponta (E2E)

**Objetivo**: Validar fluxos completos de usuário
**Cobertura**: Jornadas críticas
**Duração**: Longa

```
Fluxos E2E típicos:
1. Cadastro → Login → Usar sistema → Logout
2. Buscar produto → Adicionar carrinho → Checkout → Confirmação
3. Criar conta → Configurar perfil → Usar funcionalidades → Deletar conta
```

## Matriz de Rastreabilidade

| Requisito | Caso de Teste | Status | Prioridade |
|-----------|---------------|--------|------------|
| REQ-001: Login com email | TC-001, TC-002, TC-003 | Automatizado | Alta |
| REQ-002: Recuperar senha | TC-010, TC-011 | Manual | Média |
| REQ-003: Checkout PIX | TC-020, TC-021, TC-022 | Automatizado | Alta |

## Métricas

| Métrica | Fórmula | Meta |
|---------|---------|------|
| Cobertura de requisitos | Requisitos testados / Total requisitos | > 95% |
| Taxa de automação | Testes automatizados / Total testes | > 80% |
| Taxa de sucesso | Testes passando / Total executado | > 98% |
| Densidade de defeitos | Defeitos / KLOC | < 5 |

## Referência ISTQB

Capítulo 2 do ISTQB Foundation Level Syllabus

