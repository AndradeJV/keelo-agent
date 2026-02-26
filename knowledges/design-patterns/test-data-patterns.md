# Padrões de Dados de Teste

## Introdução

Gerenciar dados de teste é um dos maiores desafios em automação. Este documento apresenta padrões para criar, organizar e manter dados de teste de forma eficiente.

## 1. Test Data Builder

Padrão para criar objetos de teste com valores default sensíveis e customizações fluentes.

### Implementação

```typescript
// builders/UserBuilder.ts
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  isActive: boolean;
  createdAt: Date;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

class UserBuilder {
  private user: User = {
    id: crypto.randomUUID(),
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    preferences: {
      theme: 'light',
      notifications: true
    }
  };

  withName(name: string): this {
    this.user.name = name;
    return this;
  }

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  asAdmin(): this {
    this.user.role = 'admin';
    return this;
  }

  asGuest(): this {
    this.user.role = 'guest';
    return this;
  }

  inactive(): this {
    this.user.isActive = false;
    return this;
  }

  withDarkTheme(): this {
    this.user.preferences.theme = 'dark';
    return this;
  }

  build(): User {
    return { ...this.user };
  }
}

// Factory function
export const aUser = () => new UserBuilder();

// Uso
const adminUser = aUser().withName('Admin').asAdmin().build();
const inactiveUser = aUser().inactive().build();
const darkThemeUser = aUser().withDarkTheme().withName('Dark User').build();
```

### Builders Compostos

```typescript
// builders/OrderBuilder.ts
class OrderBuilder {
  private order = {
    id: crypto.randomUUID(),
    userId: '',
    items: [] as OrderItem[],
    status: 'pending' as OrderStatus,
    total: 0
  };

  forUser(user: User): this {
    this.order.userId = user.id;
    return this;
  }

  withItems(items: OrderItem[]): this {
    this.order.items = items;
    this.order.total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return this;
  }

  withItem(item: Partial<OrderItem>): this {
    const fullItem: OrderItem = {
      productId: item.productId ?? 'PROD-001',
      name: item.name ?? 'Test Product',
      price: item.price ?? 99.90,
      quantity: item.quantity ?? 1
    };
    this.order.items.push(fullItem);
    this.order.total += fullItem.price * fullItem.quantity;
    return this;
  }

  paid(): this {
    this.order.status = 'paid';
    return this;
  }

  shipped(): this {
    this.order.status = 'shipped';
    return this;
  }

  build(): Order {
    return { ...this.order, items: [...this.order.items] };
  }
}

export const anOrder = () => new OrderBuilder();

// Uso
const order = anOrder()
  .forUser(aUser().build())
  .withItem({ name: 'Product A', price: 100 })
  .withItem({ name: 'Product B', price: 50 })
  .paid()
  .build();
```

---

## 2. Object Mother

Fábrica de objetos pré-configurados para cenários comuns.

```typescript
// fixtures/ObjectMother.ts
import { aUser, anOrder, aProduct } from './builders';

export const TestUsers = {
  admin: () => aUser()
    .withName('Admin User')
    .withEmail('admin@test.com')
    .asAdmin()
    .build(),

  regularUser: () => aUser()
    .withName('Regular User')
    .withEmail('user@test.com')
    .build(),

  inactiveUser: () => aUser()
    .withName('Inactive User')
    .inactive()
    .build(),

  newUser: () => aUser()
    .withName('New User')
    .withEmail(`new-${Date.now()}@test.com`)
    .build()
};

export const TestOrders = {
  pendingOrder: (user = TestUsers.regularUser()) => anOrder()
    .forUser(user)
    .withItem({ name: 'Widget', price: 29.99, quantity: 2 })
    .build(),

  paidOrder: (user = TestUsers.regularUser()) => anOrder()
    .forUser(user)
    .withItem({ name: 'Gadget', price: 149.99 })
    .paid()
    .build(),

  largeOrder: (user = TestUsers.regularUser()) => {
    const order = anOrder().forUser(user);
    for (let i = 0; i < 50; i++) {
      order.withItem({ name: `Product ${i}`, price: 10 + i });
    }
    return order.build();
  }
};

// Uso
test('admin can cancel any order', async () => {
  const admin = TestUsers.admin();
  const order = TestOrders.paidOrder();
  // ...
});
```

---

## 3. Data Pools

Conjuntos de dados para testes parametrizados.

```typescript
// data/pools.ts

// Pool de emails para testes de validação
export const EmailPool = {
  valid: [
    'user@example.com',
    'user.name@example.com',
    'user+tag@example.com',
    'user@subdomain.example.com',
    'user@example.co.uk'
  ],
  invalid: [
    'userexample.com',      // sem @
    'user@',                // sem domínio
    '@example.com',         // sem usuário
    'user@.com',            // domínio inválido
    'user name@example.com' // espaço
  ]
};

// Pool de senhas para testes de força
export const PasswordPool = {
  weak: ['123456', 'password', 'qwerty'],
  medium: ['Pass123!', 'User@2024'],
  strong: ['C0mpl3x!P@ssw0rd', 'Tr0ub4dor&3']
};

// Pool de dados sensíveis para testes de segurança
export const InjectionPool = {
  sql: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "1; UPDATE users SET role='admin' WHERE id=1"
  ],
  xss: [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    '"><script>document.location="http://evil.com"</script>'
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '%2e%2e%2f%2e%2e%2fetc/passwd'
  ]
};

// Uso em testes parametrizados
test.describe('Email validation', () => {
  for (const email of EmailPool.valid) {
    test(`accepts valid email: ${email}`, async () => {
      // ...
    });
  }

  for (const email of EmailPool.invalid) {
    test(`rejects invalid email: ${email}`, async () => {
      // ...
    });
  }
});
```

---

## 4. Faker/Factory para Dados Aleatórios

```typescript
// utils/faker.ts
import { faker } from '@faker-js/faker/locale/pt_BR';

export const TestDataFactory = {
  user: () => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    cpf: faker.string.numeric(11),
    birthDate: faker.date.birthdate({ min: 18, max: 80, mode: 'age' })
  }),

  address: () => ({
    street: faker.location.street(),
    number: faker.number.int({ min: 1, max: 9999 }).toString(),
    neighborhood: faker.location.county(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode('#####-###')
  }),

  creditCard: () => ({
    number: faker.finance.creditCardNumber(),
    holder: faker.person.fullName().toUpperCase(),
    expiry: faker.date.future().toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' }),
    cvv: faker.finance.creditCardCVV()
  }),

  product: () => ({
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
    sku: faker.string.alphanumeric(8).toUpperCase(),
    category: faker.commerce.department()
  }),

  company: () => ({
    name: faker.company.name(),
    cnpj: faker.string.numeric(14),
    email: faker.internet.email(),
    phone: faker.phone.number()
  })
};

// Uso
const user = TestDataFactory.user();
const card = TestDataFactory.creditCard();
```

---

## 5. Database Seeding

```typescript
// seeds/TestSeeder.ts
import { db } from '../database';
import { TestUsers, TestOrders } from '../fixtures/ObjectMother';

export class TestSeeder {
  async seedUsers(count: number = 10): Promise<User[]> {
    const users = Array.from({ length: count }, () => TestUsers.newUser());
    await db.users.insertMany(users);
    return users;
  }

  async seedOrders(users: User[], ordersPerUser: number = 3): Promise<Order[]> {
    const orders: Order[] = [];
    for (const user of users) {
      for (let i = 0; i < ordersPerUser; i++) {
        orders.push(TestOrders.pendingOrder(user));
      }
    }
    await db.orders.insertMany(orders);
    return orders;
  }

  async seedComplete(): Promise<{ users: User[]; orders: Order[] }> {
    const users = await this.seedUsers(10);
    const orders = await this.seedOrders(users);
    return { users, orders };
  }

  async cleanup(): Promise<void> {
    await db.orders.deleteMany({});
    await db.users.deleteMany({});
  }
}

// Uso em teste
test.describe('Order management', () => {
  const seeder = new TestSeeder();
  let testData: { users: User[]; orders: Order[] };

  test.beforeAll(async () => {
    testData = await seeder.seedComplete();
  });

  test.afterAll(async () => {
    await seeder.cleanup();
  });

  test('list orders for user', async () => {
    const user = testData.users[0];
    const userOrders = testData.orders.filter(o => o.userId === user.id);
    // ...
  });
});
```

---

## 6. Estado de Teste com Fixtures

```typescript
// fixtures/fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TestUsers } from './ObjectMother';

// Fixture com usuário logado
export const test = base.extend<{
  loggedInPage: DashboardPage;
  adminPage: DashboardPage;
}>({
  loggedInPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    const user = TestUsers.regularUser();
    const dashboard = await loginPage.login(user.email, user.password);
    await use(dashboard);
  },

  adminPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    const admin = TestUsers.admin();
    const dashboard = await loginPage.login(admin.email, admin.password);
    await use(dashboard);
  }
});

// Uso
test('user sees dashboard after login', async ({ loggedInPage }) => {
  await expect(loggedInPage.welcomeMessage).toBeVisible();
});

test('admin can access admin panel', async ({ adminPage }) => {
  await expect(adminPage.adminPanel).toBeVisible();
});
```

---

## 7. Snapshot Testing para Dados

```typescript
// Comparar estrutura de dados com snapshot
test('API returns correct user structure', async () => {
  const response = await api.getUser('123');
  
  expect(response.data).toMatchSnapshot({
    id: expect.any(String),
    createdAt: expect.any(String),
    // Campos dinâmicos são ignorados
  });
});

// Snapshot inline para clareza
test('order total calculation', async () => {
  const order = anOrder()
    .withItem({ price: 100, quantity: 2 })
    .withItem({ price: 50, quantity: 1 })
    .build();

  expect(order.total).toMatchInlineSnapshot('250');
});
```

---

## Boas Práticas

| Prática | Descrição |
|---------|-----------|
| **Dados únicos** | Usar timestamps ou UUIDs para evitar colisões |
| **Cleanup** | Sempre limpar dados após testes |
| **Isolamento** | Cada teste cria seus próprios dados |
| **Realismo** | Dados devem ser realistas mas seguros |
| **Reutilização** | Builders e Object Mothers para consistência |
| **Versionamento** | Fixtures versionados junto com código |

## Referência

- Test Data Management Best Practices
- Growing Object-Oriented Software, Guided by Tests (Freeman & Pryce)

