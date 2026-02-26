# Níveis de Teste ISTQB

## Visão Geral

Os níveis de teste são grupos de atividades de teste organizadas e gerenciadas juntas. Cada nível tem objetivos, base de teste, objeto de teste e defeitos típicos específicos.

## 1. Teste de Componente (Unitário)

### Características

| Aspecto | Descrição |
|---------|-----------|
| **Objetivo** | Verificar funcionalidade de componentes isolados |
| **Base de Teste** | Design detalhado, código, modelo de dados |
| **Objeto de Teste** | Classes, funções, módulos, stored procedures |
| **Responsável** | Desenvolvedor (geralmente) |
| **Ambiente** | Ambiente de desenvolvimento |
| **Automação** | Alta (TDD, CI) |

### Defeitos Típicos Encontrados

- Lógica incorreta
- Tratamento de dados errado
- Código inalcançável
- Violação de padrões
- Erros de cálculo

### Exemplo

```typescript
// Componente
function calculateAge(birthDate: Date): number {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1;
  }
  return age;
}

// Teste de componente
describe('calculateAge', () => {
  it('should calculate age correctly for birthday passed this year', () => {
    const birthDate = new Date('1990-01-15');
    expect(calculateAge(birthDate)).toBe(34); // Assumindo 2024
  });

  it('should return age-1 if birthday has not occurred this year', () => {
    const birthDate = new Date('1990-12-31');
    expect(calculateAge(birthDate)).toBe(33); // Assumindo data atual antes de 31/12
  });

  it('should handle edge case of today being birthday', () => {
    const today = new Date();
    const birthDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
    expect(calculateAge(birthDate)).toBe(30);
  });
});
```

---

## 2. Teste de Integração

### Características

| Aspecto | Descrição |
|---------|-----------|
| **Objetivo** | Verificar interações entre componentes/sistemas |
| **Base de Teste** | Design de sistema, arquitetura, workflows, APIs |
| **Objeto de Teste** | Subsistemas, bancos de dados, APIs, microsserviços |
| **Responsável** | Desenvolvedor ou QA |
| **Ambiente** | Ambiente de integração |
| **Automação** | Média a Alta |

### Tipos de Integração

**Integração de Componentes (Small Integration)**:
- Entre módulos do mesmo sistema
- Foco em interfaces internas

**Integração de Sistemas (Large Integration)**:
- Entre sistemas diferentes
- Foco em APIs, mensageria, dados compartilhados

### Estratégias de Integração

| Estratégia | Descrição | Vantagem | Desvantagem |
|------------|-----------|----------|-------------|
| **Big Bang** | Integrar tudo de uma vez | Rápido | Difícil isolar problemas |
| **Top-Down** | Começar pelos níveis altos | Lógica de negócio cedo | Precisa de stubs |
| **Bottom-Up** | Começar pelos níveis baixos | Componentes reais | Interface tarde |
| **Sandwich** | Combina top-down e bottom-up | Balanceado | Complexo de coordenar |

### Defeitos Típicos Encontrados

- Incompatibilidade de interfaces
- Dados malformados entre componentes
- Problemas de sequenciamento
- Conflitos de recursos
- Falhas de comunicação

### Exemplo

```typescript
// Teste de integração: UserService + Database
describe('UserService Integration', () => {
  let db: Database;
  let userService: UserService;

  beforeAll(async () => {
    db = await Database.connect(TEST_DATABASE_URL);
    userService = new UserService(db);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clear('users');
  });

  it('should create user and persist to database', async () => {
    const userData = { name: 'Test', email: 'test@test.com' };
    
    const user = await userService.create(userData);
    
    const savedUser = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
    expect(savedUser.rows[0].email).toBe('test@test.com');
  });

  it('should rollback transaction on validation error', async () => {
    const userData = { name: '', email: 'invalid' }; // Dados inválidos
    
    await expect(userService.create(userData)).rejects.toThrow('Validation error');
    
    const count = await db.query('SELECT COUNT(*) FROM users');
    expect(count.rows[0].count).toBe('0');
  });
});
```

---

## 3. Teste de Sistema

### Características

| Aspecto | Descrição |
|---------|-----------|
| **Objetivo** | Verificar comportamento do sistema completo |
| **Base de Teste** | Requisitos funcionais e não-funcionais, casos de uso |
| **Objeto de Teste** | Sistema integrado, fluxos end-to-end |
| **Responsável** | Equipe de QA |
| **Ambiente** | Ambiente similar a produção |
| **Automação** | Média (E2E críticos) |

### Escopo

- Funcionalidades end-to-end
- Requisitos não-funcionais (performance, segurança)
- Comportamento em ambiente completo
- Integração com sistemas externos

### Defeitos Típicos Encontrados

- Funcionalidades não atendem requisitos
- Fluxos de negócio incorretos
- Performance inadequada
- Problemas de segurança
- Incompatibilidades de ambiente

### Exemplo

```typescript
// Teste de sistema E2E com Playwright
test.describe('Checkout Flow', () => {
  test('should complete purchase successfully', async ({ page }) => {
    // Arrange: Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'customer@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('[type="submit"]');
    
    // Act: Add product to cart
    await page.goto('/products');
    await page.click('[data-testid="product-1"] >> text=Add to Cart');
    
    // Act: Checkout
    await page.click('[data-testid="cart-icon"]');
    await page.click('text=Proceed to Checkout');
    
    // Act: Payment
    await page.fill('[name="card-number"]', '4111111111111111');
    await page.fill('[name="expiry"]', '12/25');
    await page.fill('[name="cvv"]', '123');
    await page.click('text=Complete Purchase');
    
    // Assert
    await expect(page.locator('.order-confirmation')).toBeVisible();
    await expect(page.locator('.order-number')).toContainText(/ORD-\d+/);
    
    // Verificar email (integração com sistema de email)
    const email = await getLastEmailFor('customer@test.com');
    expect(email.subject).toContain('Order Confirmation');
  });

  test('should handle payment failure gracefully', async ({ page }) => {
    // ... setup ...
    
    await page.fill('[name="card-number"]', '4000000000000002'); // Cartão que falha
    await page.click('text=Complete Purchase');
    
    await expect(page.locator('.error-message')).toContainText('Payment declined');
    await expect(page.locator('.cart-items')).toBeVisible(); // Carrinho preservado
  });
});
```

---

## 4. Teste de Aceite

### Características

| Aspecto | Descrição |
|---------|-----------|
| **Objetivo** | Validar que o sistema atende necessidades do negócio |
| **Base de Teste** | Requisitos de negócio, processos, regulamentos |
| **Objeto de Teste** | Sistema em ambiente de produção ou similar |
| **Responsável** | Usuários, PO, stakeholders |
| **Ambiente** | Produção ou UAT |
| **Automação** | Baixa (geralmente manual) |

### Tipos de Teste de Aceite

#### User Acceptance Testing (UAT)

Validação pelos usuários finais.

```gherkin
Funcionalidade: Aprovação de pedido de compra

Cenário: Gerente aprova pedido dentro do limite
  Dado que sou gerente com limite de aprovação de R$ 10.000
  E existe um pedido pendente de R$ 5.000
  Quando abro o pedido
  E clico em "Aprovar"
  Então o pedido deve mudar para status "Aprovado"
  E o solicitante deve receber notificação
  E o pedido deve ir para o financeiro
```

#### Operational Acceptance Testing (OAT)

Validação de aspectos operacionais.

```gherkin
Cenário: Backup automático funciona
  Dado que é 3h da manhã
  Quando o job de backup executa
  Então todos os dados devem ser copiados
  E o backup deve ser verificável
  E deve haver log de sucesso

Cenário: Sistema recupera após falha
  Dado que o servidor principal falha
  Quando o failover é ativado
  Então o sistema deve voltar em menos de 5 minutos
  E não deve haver perda de dados
```

#### Contract Acceptance Testing

Validação de contratos/acordos.

```gherkin
Cenário: SLA de tempo de resposta
  Dado que o sistema está em produção
  Quando monitoro por 24 horas
  Então 99% das requisições devem responder em menos de 500ms
  E o uptime deve ser maior que 99.9%
```

#### Regulatory Acceptance Testing

Validação de conformidade com regulamentos.

```gherkin
Cenário: Conformidade LGPD - Direito ao esquecimento
  Dado que sou usuário cadastrado
  Quando solicito exclusão dos meus dados
  Então todos os dados pessoais devem ser removidos em 72 horas
  E devo receber confirmação por email
  E os dados não devem ser recuperáveis
```

### Critérios de Aceite

**Formato BDD (Gherkin)**:
```gherkin
Dado [contexto inicial]
Quando [ação do usuário]
Então [resultado esperado]
```

**Formato User Story + Critérios**:
```
Como [persona]
Quero [funcionalidade]
Para [benefício]

Critérios de Aceite:
- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3
```

---

## Comparação dos Níveis

| Aspecto | Componente | Integração | Sistema | Aceite |
|---------|------------|------------|---------|--------|
| Escopo | Unitário | Módulos | Sistema todo | Negócio |
| Quem testa | Dev | Dev/QA | QA | Usuário/PO |
| Automação | Alta | Média | Média | Baixa |
| Velocidade | Segundos | Minutos | Minutos/Horas | Horas/Dias |
| Custo de falha | Baixo | Médio | Alto | Muito alto |
| Frequência | Contínua | Contínua | Por release | Por release |

---

## Referência

ISTQB Foundation Level Syllabus v4.0 - Capítulo 2

