# Page Object Model (POM)

## Definição

O Page Object Model é um padrão de design para automação de testes que cria uma camada de abstração entre os testes e a interface do usuário. Cada página ou componente da aplicação é representado por uma classe.

## Princípios

1. **Separação de responsabilidades**: Testes focam em "o quê", Page Objects focam em "como"
2. **Encapsulamento**: Seletores e ações ficam no Page Object, não nos testes
3. **Reutilização**: Mesma página usada em múltiplos testes
4. **Manutenibilidade**: Mudança na UI = mudança em um lugar só

## Estrutura Básica

```
e2e/
├── pages/                    # Page Objects
│   ├── BasePage.ts          # Classe base com métodos comuns
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── components/          # Componentes reutilizáveis
│       ├── Header.ts
│       ├── Modal.ts
│       └── DataTable.ts
├── tests/                    # Arquivos de teste
│   ├── login.spec.ts
│   └── dashboard.spec.ts
├── fixtures/                 # Dados de teste
│   └── users.json
└── utils/                    # Helpers
    └── helpers.ts
```

## Implementação

### Classe Base

```typescript
// pages/BasePage.ts
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;
  protected abstract readonly url: string;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(): Promise<void> {
    await this.page.goto(this.url);
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  protected getByTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }
}
```

### Page Object Completo

```typescript
// pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { DashboardPage } from './DashboardPage';

export class LoginPage extends BasePage {
  protected readonly url = '/login';

  // Locators como propriedades readonly
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = this.getByTestId('email-input');
    this.passwordInput = this.getByTestId('password-input');
    this.submitButton = this.getByTestId('login-button');
    this.errorMessage = this.getByTestId('error-message');
    this.forgotPasswordLink = page.getByRole('link', { name: 'Esqueci a senha' });
    this.rememberMeCheckbox = page.getByLabel('Lembrar-me');
  }

  // Ações de alto nível
  async login(email: string, password: string): Promise<DashboardPage> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    return new DashboardPage(this.page);
  }

  async loginWithRememberMe(email: string, password: string): Promise<DashboardPage> {
    await this.rememberMeCheckbox.check();
    return this.login(email, password);
  }

  async loginExpectingError(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await expect(this.errorMessage).toBeVisible();
  }

  // Métodos de verificação
  async getErrorText(): Promise<string> {
    return this.errorMessage.textContent() ?? '';
  }

  async isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }

  // Navegação para outras páginas
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }
}
```

### Componentes Reutilizáveis

```typescript
// pages/components/Header.ts
import { Page, Locator } from '@playwright/test';

export class Header {
  private readonly page: Page;
  readonly logo: Locator;
  readonly userMenu: Locator;
  readonly searchInput: Locator;
  readonly notificationBell: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.locator('[data-testid="logo"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.searchInput = page.locator('[data-testid="global-search"]');
    this.notificationBell = page.locator('[data-testid="notifications"]');
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }

  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.page.click('text=Sair');
  }

  async getNotificationCount(): Promise<number> {
    const badge = this.notificationBell.locator('.badge');
    const text = await badge.textContent();
    return parseInt(text ?? '0', 10);
  }
}

// pages/DashboardPage.ts
import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { Header } from './components/Header';

export class DashboardPage extends BasePage {
  protected readonly url = '/dashboard';
  
  readonly header: Header;
  readonly welcomeMessage: Locator;
  readonly statsCards: Locator;

  constructor(page: Page) {
    super(page);
    this.header = new Header(page);
    this.welcomeMessage = this.getByTestId('welcome-message');
    this.statsCards = this.getByTestId('stats-card');
  }

  async getWelcomeText(): Promise<string> {
    return this.welcomeMessage.textContent() ?? '';
  }

  async getStatsCount(): Promise<number> {
    return this.statsCards.count();
  }
}
```

### Arquivo de Teste

```typescript
// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Login Feature', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should login successfully with valid credentials', async () => {
    const dashboardPage = await loginPage.login('user@test.com', 'password123');
    
    await expect(dashboardPage.welcomeMessage).toBeVisible();
    expect(await dashboardPage.getWelcomeText()).toContain('Bem-vindo');
  });

  test('should show error with invalid credentials', async () => {
    await loginPage.loginExpectingError('invalid@test.com', 'wrong');
    
    expect(await loginPage.getErrorText()).toContain('Credenciais inválidas');
  });

  test('should disable submit button when fields are empty', async () => {
    expect(await loginPage.isSubmitEnabled()).toBe(false);
  });

  test('should navigate to forgot password', async () => {
    await loginPage.goToForgotPassword();
    
    await expect(loginPage.page).toHaveURL(/forgot-password/);
  });
});
```

## Boas Práticas

### ✅ Fazer

| Prática | Exemplo |
|---------|---------|
| Usar seletores semânticos | `[data-testid="login-button"]`, `role`, `label` |
| Retornar Page Object em navegação | `login() → DashboardPage` |
| Métodos de alto nível | `login(email, password)` ao invés de `fillEmail()`, `fillPassword()`, `click()` |
| Composição para componentes | `Header`, `Footer`, `Modal` como classes separadas |
| Nomes descritivos | `loginExpectingError()`, `getWelcomeText()` |

### ❌ Evitar

| Anti-pattern | Problema |
|--------------|----------|
| Assertions no Page Object | Acopla lógica de verificação |
| Seletores frágeis | `.btn-primary:nth-child(3)` quebra facilmente |
| Page Objects muito grandes | Difícil manutenção, dividir em componentes |
| Lógica de negócio | Page Object é infraestrutura, não regras |
| Expor Page internamente | Encapsular acesso à página |

## Fluent Interface

Variação que permite encadeamento de métodos:

```typescript
class CheckoutPage extends BasePage {
  async fillShipping(address: ShippingAddress): Promise<this> {
    await this.streetInput.fill(address.street);
    await this.cityInput.fill(address.city);
    await this.zipInput.fill(address.zip);
    return this; // Retorna this para encadeamento
  }

  async selectPayment(method: string): Promise<this> {
    await this.paymentSelect.selectOption(method);
    return this;
  }

  async confirmOrder(): Promise<OrderConfirmationPage> {
    await this.confirmButton.click();
    return new OrderConfirmationPage(this.page);
  }
}

// Uso fluente
const confirmationPage = await checkoutPage
  .fillShipping({ street: 'Rua X', city: 'SP', zip: '01234-000' })
  .selectPayment('credit_card')
  .confirmOrder();
```

## Fixtures para Dados

```typescript
// fixtures/users.ts
export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin'
  },
  customer: {
    email: 'customer@test.com', 
    password: 'customer123',
    role: 'customer'
  },
  invalid: {
    email: 'invalid@test.com',
    password: 'wrongpassword',
    role: 'none'
  }
};

// Uso no teste
import { testUsers } from '../fixtures/users';

test('admin can access admin panel', async () => {
  const dashboard = await loginPage.login(testUsers.admin.email, testUsers.admin.password);
  await expect(dashboard.adminPanel).toBeVisible();
});
```

## Referência

- Martin Fowler - PageObject Pattern: https://martinfowler.com/bliki/PageObject.html
- Playwright Best Practices: https://playwright.dev/docs/pom

