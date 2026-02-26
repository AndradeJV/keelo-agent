# Screenplay Pattern

## Introdução

O Screenplay Pattern (também conhecido como Journey Pattern) é uma evolução do Page Object Model que modela testes em termos de **Atores**, **Tarefas** e **Habilidades**. É especialmente útil para testes complexos que envolvem múltiplos usuários ou interações.

## Conceitos Fundamentais

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCREENPLAY PATTERN                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ATOR (Actor)                                                  │
│   └── Representa um usuário/persona                             │
│       └── Possui HABILIDADES (Abilities)                        │
│           └── Ex: BrowseTheWeb, CallAnApi, UseDatabase          │
│       └── Executa TAREFAS (Tasks)                               │
│           └── Ex: Login, CompletePurchase, SearchProduct        │
│       └── Faz PERGUNTAS (Questions)                             │
│           └── Ex: TheCartTotal, TheErrorMessage                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Actor (Ator)

Representa uma persona que interage com o sistema.

```typescript
// screenplay/actors/Actor.ts
import { Page } from '@playwright/test';

export class Actor {
  private name: string;
  private abilities: Map<string, Ability> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  can<T extends Ability>(ability: T): this {
    this.abilities.set(ability.constructor.name, ability);
    return this;
  }

  abilityTo<T extends Ability>(abilityType: new (...args: any[]) => T): T {
    const ability = this.abilities.get(abilityType.name);
    if (!ability) {
      throw new Error(`${this.name} doesn't have the ability: ${abilityType.name}`);
    }
    return ability as T;
  }

  async attemptsTo(...tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await task.performAs(this);
    }
  }

  async asks<T>(question: Question<T>): Promise<T> {
    return question.answeredBy(this);
  }

  toString(): string {
    return this.name;
  }
}

// Factory
export const actorCalled = (name: string) => new Actor(name);
```

### 2. Ability (Habilidade)

Capacidade que um ator possui para interagir com o sistema.

```typescript
// screenplay/abilities/BrowseTheWeb.ts
import { Page } from '@playwright/test';

export interface Ability {}

export class BrowseTheWeb implements Ability {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  static using(page: Page): BrowseTheWeb {
    return new BrowseTheWeb(page);
  }

  getPage(): Page {
    return this.page;
  }
}

// screenplay/abilities/CallAnApi.ts
export class CallAnApi implements Ability {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  static at(baseUrl: string): CallAnApi {
    return new CallAnApi(baseUrl);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async get(endpoint: string): Promise<Response> {
    return fetch(`${this.baseUrl}${endpoint}`);
  }

  async post(endpoint: string, body: any): Promise<Response> {
    return fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
}
```

### 3. Task (Tarefa)

Ação ou conjunto de ações que um ator pode executar.

```typescript
// screenplay/tasks/Task.ts
import { Actor } from '../actors/Actor';

export interface Task {
  performAs(actor: Actor): Promise<void>;
}

// screenplay/tasks/Login.ts
import { Actor } from '../actors/Actor';
import { BrowseTheWeb } from '../abilities/BrowseTheWeb';
import { Task } from './Task';

export class Login implements Task {
  private email: string;
  private password: string;

  private constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  static withCredentials(email: string, password: string): Login {
    return new Login(email, password);
  }

  async performAs(actor: Actor): Promise<void> {
    const page = actor.abilityTo(BrowseTheWeb).getPage();
    
    await page.goto('/login');
    await page.fill('[data-testid="email"]', this.email);
    await page.fill('[data-testid="password"]', this.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/dashboard/);
  }
}

// screenplay/tasks/AddToCart.ts
export class AddToCart implements Task {
  private productId: string;
  private quantity: number;

  private constructor(productId: string, quantity: number) {
    this.productId = productId;
    this.quantity = quantity;
  }

  static product(productId: string): { withQuantity: (qty: number) => AddToCart } {
    return {
      withQuantity: (quantity: number) => new AddToCart(productId, quantity)
    };
  }

  async performAs(actor: Actor): Promise<void> {
    const page = actor.abilityTo(BrowseTheWeb).getPage();
    
    await page.goto(`/products/${this.productId}`);
    await page.fill('[data-testid="quantity"]', this.quantity.toString());
    await page.click('[data-testid="add-to-cart"]');
    await page.waitForSelector('[data-testid="cart-notification"]');
  }
}

// screenplay/tasks/CompletePurchase.ts
export class CompletePurchase implements Task {
  private paymentMethod: string;

  private constructor(paymentMethod: string) {
    this.paymentMethod = paymentMethod;
  }

  static using(paymentMethod: string): CompletePurchase {
    return new CompletePurchase(paymentMethod);
  }

  async performAs(actor: Actor): Promise<void> {
    const page = actor.abilityTo(BrowseTheWeb).getPage();
    
    await page.click('[data-testid="checkout-button"]');
    await page.click(`[data-testid="payment-${this.paymentMethod}"]`);
    await page.click('[data-testid="confirm-purchase"]');
    await page.waitForSelector('[data-testid="order-confirmation"]');
  }
}
```

### 4. Question (Pergunta)

Consulta sobre o estado do sistema que o ator pode fazer.

```typescript
// screenplay/questions/Question.ts
import { Actor } from '../actors/Actor';

export interface Question<T> {
  answeredBy(actor: Actor): Promise<T>;
}

// screenplay/questions/TheCartTotal.ts
import { Actor } from '../actors/Actor';
import { BrowseTheWeb } from '../abilities/BrowseTheWeb';
import { Question } from './Question';

export class TheCartTotal implements Question<number> {
  async answeredBy(actor: Actor): Promise<number> {
    const page = actor.abilityTo(BrowseTheWeb).getPage();
    const totalText = await page.locator('[data-testid="cart-total"]').textContent();
    return parseFloat(totalText?.replace(/[^\d.,]/g, '').replace(',', '.') ?? '0');
  }
}

export const theCartTotal = () => new TheCartTotal();

// screenplay/questions/TheErrorMessage.ts
export class TheErrorMessage implements Question<string> {
  async answeredBy(actor: Actor): Promise<string> {
    const page = actor.abilityTo(BrowseTheWeb).getPage();
    return await page.locator('[data-testid="error-message"]').textContent() ?? '';
  }
}

export const theErrorMessage = () => new TheErrorMessage();

// screenplay/questions/TheNumberOfItemsIn.ts
export class TheNumberOfItemsIn implements Question<number> {
  private containerTestId: string;

  private constructor(containerTestId: string) {
    this.containerTestId = containerTestId;
  }

  static the(containerTestId: string): TheNumberOfItemsIn {
    return new TheNumberOfItemsIn(containerTestId);
  }

  async answeredBy(actor: Actor): Promise<number> {
    const page = actor.abilityTo(BrowseTheWeb).getPage();
    return await page.locator(`[data-testid="${this.containerTestId}"] > *`).count();
  }
}

export const theNumberOfItemsIn = (container: string) => TheNumberOfItemsIn.the(container);
```

## Uso em Testes

```typescript
// tests/purchase.spec.ts
import { test, expect } from '@playwright/test';
import { actorCalled } from '../screenplay/actors/Actor';
import { BrowseTheWeb } from '../screenplay/abilities/BrowseTheWeb';
import { Login } from '../screenplay/tasks/Login';
import { AddToCart } from '../screenplay/tasks/AddToCart';
import { CompletePurchase } from '../screenplay/tasks/CompletePurchase';
import { theCartTotal, theNumberOfItemsIn } from '../screenplay/questions';

test.describe('Purchase Journey', () => {
  test('customer can complete a purchase', async ({ page }) => {
    // Arrange
    const customer = actorCalled('João')
      .can(BrowseTheWeb.using(page));

    // Act
    await customer.attemptsTo(
      Login.withCredentials('joao@test.com', 'password123'),
      AddToCart.product('PROD-001').withQuantity(2),
      AddToCart.product('PROD-002').withQuantity(1)
    );

    // Assert intermediate state
    const cartItems = await customer.asks(theNumberOfItemsIn('cart-items'));
    expect(cartItems).toBe(2);

    const total = await customer.asks(theCartTotal());
    expect(total).toBeGreaterThan(0);

    // Complete purchase
    await customer.attemptsTo(
      CompletePurchase.using('credit_card')
    );

    // Assert final state
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
  });

  test('guest cannot checkout without login', async ({ page }) => {
    const guest = actorCalled('Visitante')
      .can(BrowseTheWeb.using(page));

    await guest.attemptsTo(
      AddToCart.product('PROD-001').withQuantity(1)
    );

    // Tentar checkout sem login deve redirecionar
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL(/login/);
  });
});
```

## Comparação com Page Object

| Aspecto | Page Object | Screenplay |
|---------|-------------|------------|
| Foco | Páginas e elementos | Comportamento do usuário |
| Granularidade | Uma classe por página | Tarefas compostas |
| Reuso | Métodos em páginas | Tarefas combinadas |
| Legibilidade | Técnica | Linguagem de negócio |
| Múltiplos atores | Manual | Nativo |
| Complexidade | Baixa | Média-Alta |

## Quando Usar

### Use Screenplay quando:
- ✅ Testes envolvem múltiplos usuários/personas
- ✅ Jornadas complexas com muitas etapas
- ✅ Alta reutilização de comportamentos
- ✅ Stakeholders não-técnicos leem testes
- ✅ BDD é usado

### Use Page Object quando:
- ✅ Testes simples e diretos
- ✅ Equipe pequena
- ✅ Curva de aprendizado é preocupação
- ✅ Projeto menor

## Referência

- Serenity BDD: https://serenity-bdd.github.io/docs/screenplay/screenplay_fundamentals
- Antony Marcano - Screenplay Pattern

