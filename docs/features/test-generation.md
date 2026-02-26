# Geração de Testes

O Keelo gera testes automatizados baseados na análise de PRs e requisitos.

## Como Funciona

```
┌─────────────────────────────────────────────────────────────┐
│                    GERAÇÃO DE TESTES                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. ANÁLISE                                                │
│   ├── Lê o diff do PR                                       │
│   ├── Identifica arquivos alterados                        │
│   └── Extrai contexto (imports, tipos)                      │
│                                                              │
│   2. DETECÇÃO DE FRAMEWORK                                  │
│   ├── Lê package.json                                       │
│   ├── Identifica Playwright/Jest/Vitest                    │
│   └── Detecta padrões existentes                            │
│                                                              │
│   3. GERAÇÃO                                                │
│   ├── LLM gera código de teste                             │
│   ├── Valida sintaxe                                        │
│   └── Formata com prettier                                  │
│                                                              │
│   4. CRIAÇÃO DE PR                                          │
│   ├── Cria branch tests/keelo-xxx                          │
│   ├── Commita os testes                                     │
│   └── Abre PR como draft                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Tipos de Testes

### E2E (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('deve fazer login com credenciais válidas', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('deve mostrar erro com senha incorreta', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]'))
      .toBeVisible();
  });
});
```

### Unitários (Vitest/Jest)

```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it('deve aceitar email válido', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('deve rejeitar email sem @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('deve rejeitar email vazio', () => {
    expect(validateEmail('')).toBe(false);
  });
});
```

## Priorização de Framework

O Keelo **sempre prioriza o que já existe no projeto**:

1. Lê `package.json`
2. Identifica dependências de teste
3. Usa o mesmo framework

```
Se package.json tem:
  "playwright": "^1.x" → Gera Playwright
  "jest": "^29.x" → Gera Jest
  "vitest": "^1.x" → Gera Vitest
```

**Nunca gera testes de API (supertest) se o projeto é só frontend.**

## Estrutura de Arquivos

O Keelo segue a estrutura existente:

```
Se o projeto tem:
  tests/
    e2e/
      login.spec.ts
      
Keelo gera em:
  tests/
    e2e/
      [nova-feature].spec.ts
```

## Configuração

### Ativar Geração Automática

No Dashboard → Configurações:
- ✅ Gerar testes automaticamente
- ✅ Criar PRs como Draft

### Validação de Sintaxe

O Keelo valida os testes antes de commitar:

```typescript
// test-validator.ts
- Verifica se o código compila
- Verifica imports
- Verifica estrutura do teste
```

Se houver erro de sintaxe, o teste não é commitado.

## PR de Testes

O Keelo cria um PR separado com os testes:

```markdown
# tests: add e2e tests for login feature

## Descrição
Testes gerados automaticamente pelo Keelo para cobrir as mudanças em #42.

## Testes Adicionados
- `tests/e2e/login.spec.ts`
  - Login com credenciais válidas
  - Login com senha incorreta
  - Login com email inválido

## Cobertura
- Arquivos alterados: 3
- Cenários cobertos: 5

---
_Gerado automaticamente por Keelo QA_
```

## Monitoramento de CI

Se habilitado, o Keelo monitora o CI:

1. **Testes passam** → Notifica no Slack ✅
2. **Testes falham** → Tenta auto-fix
3. **Auto-fix funciona** → Commita correção
4. **Auto-fix falha** → Notifica para revisão manual

## Personalização

### Prompt de Geração

O prompt está em `prompts/test-generator.pt-br.md`:

```markdown
Você é um especialista em QA. Gere testes para:

- Framework: {{framework}}
- Arquivos alterados: {{files}}
- Contexto: {{context}}

Regras:
1. Use data-testid quando disponível
2. Teste casos de sucesso e erro
3. Siga o padrão AAA (Arrange, Act, Assert)
```

## Próximos Passos

- [Runtime Explorer](./runtime-explorer.md)
- [Dashboard](./dashboard.md)

