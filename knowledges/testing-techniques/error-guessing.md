# Error Guessing (Adivinhação de Erros)

## Definição

Técnica baseada na experiência onde o testador usa conhecimento prévio de defeitos comuns, áreas problemáticas e padrões de falha para identificar cenários de teste que provavelmente revelarão defeitos.

## Fundamento

Testadores experientes desenvolvem intuição sobre onde defeitos tendem a ocorrer. Error guessing formaliza essa experiência em checklists e heurísticas reutilizáveis.

## Fontes de Conhecimento

1. **Histórico de defeitos** - Bugs encontrados anteriormente no sistema
2. **Padrões da indústria** - Erros comuns em sistemas similares
3. **Complexidade do código** - Áreas modificadas frequentemente
4. **Experiência pessoal** - Intuição do testador
5. **Análise de riscos** - Áreas de alto impacto

## Catálogo de Erros Comuns

### Manipulação de Dados

| Área | Erros Típicos |
|------|---------------|
| **Strings** | Null, vazio, espaços, caracteres especiais, Unicode, SQL injection, XSS |
| **Números** | Zero, negativos, decimais, overflow, NaN, Infinity |
| **Datas** | Null, formato inválido, fuso horário, horário de verão, ano bissexto |
| **Listas** | Vazia, um item, muitos itens, duplicados, ordenação |
| **Arquivos** | Vazio, muito grande, formato errado, corrompido, sem permissão |

### Condições de Contorno

| Situação | Cenários a Testar |
|----------|-------------------|
| **Primeiro/Último** | Primeiro usuário, último item da lista, fim de página |
| **Limites de recursos** | Memória cheia, disco cheio, conexões esgotadas |
| **Timeouts** | Operação demorada, timeout de sessão, conexão lenta |
| **Concorrência** | Dois usuários simultâneos, click duplo, submit repetido |

### Estados do Sistema

| Estado | Cenários a Testar |
|--------|-------------------|
| **Inicialização** | Primeiro acesso, banco vazio, sem configuração |
| **Recuperação** | Após crash, após timeout, após erro de rede |
| **Manutenção** | Durante backup, durante deploy, durante migração |

## Checklist de Error Guessing

### Inputs
- [ ] Campo vazio
- [ ] Apenas espaços
- [ ] Caracteres especiais: `<>'"&;/\|`
- [ ] Emoji e Unicode: `🔥 中文 العربية`
- [ ] HTML: `<script>alert('xss')</script>`
- [ ] SQL: `'; DROP TABLE users; --`
- [ ] Muito longo (além do limite)
- [ ] Copiar/colar com formatação

### Ações
- [ ] Click duplo em botão submit
- [ ] Enter no campo (submit implícito)
- [ ] Voltar (back) após submit
- [ ] Refresh durante operação
- [ ] Fechar aba durante upload
- [ ] Múltiplas abas com mesma sessão

### Rede
- [ ] Conexão lenta (3G)
- [ ] Perda de conexão durante operação
- [ ] API retorna erro 500
- [ ] API demora para responder
- [ ] Resposta malformada

### Navegação
- [ ] Acessar URL direta sem autenticação
- [ ] Manipular parâmetros na URL
- [ ] Voltar após logout
- [ ] Deep link para página específica

### Datas e Horários
- [ ] 29 de fevereiro (ano bissexto)
- [ ] 31 de mês com 30 dias
- [ ] Virada de ano (31/12 → 01/01)
- [ ] Mudança de horário de verão
- [ ] Fuso horário diferente do servidor

## Exemplo de Cenários

```gherkin
Funcionalidade: Cadastro de usuário (Error Guessing)

# Input problemático
Cenário: Nome com caracteres especiais
  Dado que estou na página de cadastro
  Quando informo nome "O'Connor-Smith"
  Então o cadastro deve ser aceito
  E o nome deve ser salvo corretamente

Cenário: Email com caracteres incomuns válidos
  Dado que estou na página de cadastro
  Quando informo email "user+tag@sub.domain.co.uk"
  Então o cadastro deve ser aceito

# Ação problemática
Cenário: Click duplo no botão de cadastro
  Dado que preenchi o formulário corretamente
  Quando clico duas vezes rapidamente em "Cadastrar"
  Então apenas um cadastro deve ser criado
  E não devo ver erro de duplicidade

# Condição de rede
Cenário: Perda de conexão durante cadastro
  Dado que preenchi o formulário corretamente
  E perco conexão com a internet
  Quando clico em "Cadastrar"
  Então devo ver mensagem de erro de conexão
  E os dados do formulário devem ser preservados

# Estado do sistema
Cenário: Primeiro usuário do sistema
  Dado que o banco de dados está vazio
  Quando crio o primeiro usuário
  Então o cadastro deve funcionar
  E o usuário deve receber papel de administrador
```

## Taxonomia de Defeitos (Para Guiar)

### Por Categoria

| Categoria | % de Defeitos | Foco |
|-----------|---------------|------|
| Lógica de negócio | 25% | Regras, cálculos, validações |
| Interface | 20% | Usabilidade, feedback, estados |
| Integração | 18% | APIs, banco, serviços externos |
| Performance | 12% | Lentidão, memória, concorrência |
| Segurança | 10% | Autenticação, autorização, injeção |
| Dados | 10% | Formato, encoding, persistência |
| Config/Deploy | 5% | Ambiente, variáveis, dependências |

## Quando Usar

- ✅ Complementar técnicas sistemáticas
- ✅ Teste exploratório guiado
- ✅ Áreas de alto risco
- ✅ Código complexo ou legado
- ✅ Após mudanças significativas
- ✅ Quando tempo é limitado

## Referência ISTQB

Seção 4.4.1 do ISTQB Foundation Level Syllabus (Técnicas baseadas em experiência)

