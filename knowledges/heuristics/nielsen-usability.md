# 10 Heurísticas de Usabilidade de Nielsen

## Introdução

As 10 heurísticas de usabilidade de Jakob Nielsen são princípios gerais para design de interface. São usadas para avaliação heurística - inspeção de usabilidade por especialistas.

## As 10 Heurísticas

### 1. Visibilidade do Status do Sistema

**Princípio**: O sistema deve sempre manter os usuários informados sobre o que está acontecendo, através de feedback apropriado em tempo razoável.

**Exemplos de Conformidade**:
- Loading spinner durante operações
- Barra de progresso em uploads
- Mensagem "Salvando..." ao editar
- Indicador de etapa em wizards (Passo 2 de 5)
- Badge de notificações não lidas

**Cenários de Teste**:
```gherkin
Cenário: Feedback durante upload de arquivo
  Dado que seleciono um arquivo de 10MB
  Quando inicio o upload
  Então devo ver barra de progresso
  E devo ver porcentagem atualizada
  E ao completar devo ver "Upload concluído"

Cenário: Indicação de processamento
  Dado que submeto um formulário
  Quando o sistema está processando
  Então o botão deve mostrar estado de loading
  E o botão deve estar desabilitado
```

**Defeitos Típicos**:
- Tela congelada sem feedback
- Operação concluída sem confirmação
- Estado inconsistente entre tabs

---

### 2. Correspondência entre Sistema e Mundo Real

**Princípio**: O sistema deve falar a linguagem do usuário, com palavras, frases e conceitos familiares, seguindo convenções do mundo real.

**Exemplos de Conformidade**:
- Ícone de carrinho de compras
- "Lixeira" para itens deletados
- Termos de negócio do domínio
- Formatos locais (data, moeda)

**Cenários de Teste**:
```gherkin
Cenário: Formato de moeda brasileiro
  Dado que estou no Brasil
  Quando visualizo preços
  Então devem estar no formato "R$ 1.234,56"

Cenário: Terminologia do domínio
  Dado que sou um usuário contador
  Quando vejo o menu
  Então devo ver "Lançamentos" ao invés de "Entries"
  E devo ver "Balancete" ao invés de "Balance Sheet"
```

**Defeitos Típicos**:
- Jargão técnico exposto ao usuário
- Formato de data americano (MM/DD/YYYY)
- Mensagens de erro com códigos

---

### 3. Controle e Liberdade do Usuário

**Princípio**: Usuários frequentemente escolhem funções por engano e precisam de uma "saída de emergência" clara para deixar o estado indesejado.

**Exemplos de Conformidade**:
- Botão "Cancelar" em modais
- "Desfazer" após ações destrutivas
- Voltar em fluxos multi-etapa
- Sair de modo de edição

**Cenários de Teste**:
```gherkin
Cenário: Desfazer exclusão
  Dado que deleto um item
  Quando vejo a confirmação
  Então devo ver opção "Desfazer"
  E ao clicar em "Desfazer"
  Então o item deve ser restaurado

Cenário: Cancelar wizard no meio
  Dado que estou na etapa 3 de 5 do cadastro
  Quando clico em "Cancelar"
  Então devo poder escolher salvar rascunho ou descartar
```

**Defeitos Típicos**:
- Modal sem botão de fechar
- Ação destrutiva sem confirmação
- Impossível voltar em fluxos

---

### 4. Consistência e Padrões

**Princípio**: Usuários não devem ter que imaginar se palavras, situações ou ações diferentes significam a mesma coisa. Siga convenções da plataforma.

**Exemplos de Conformidade**:
- Mesmo botão de salvar em todas as telas
- Cores consistentes (verde=sucesso, vermelho=erro)
- Navegação sempre no mesmo lugar
- Atalhos de teclado padrão (Ctrl+S, Ctrl+Z)

**Cenários de Teste**:
```gherkin
Cenário: Botão primário consistente
  Dado que navego por 5 telas diferentes com ações
  Quando observo os botões de ação principal
  Então todos devem ter a mesma cor
  E todos devem estar na mesma posição relativa

Cenário: Comportamento de formulário consistente
  Dado que preencho qualquer formulário do sistema
  Quando pressiono Enter no último campo
  Então o formulário deve ser submetido
```

**Defeitos Típicos**:
- Botão "Confirmar" vs "OK" vs "Salvar"
- Cores diferentes para mesma ação
- Menu em posições diferentes

---

### 5. Prevenção de Erros

**Princípio**: Melhor que boas mensagens de erro é um design cuidadoso que previne que um problema ocorra em primeiro lugar.

**Exemplos de Conformidade**:
- Desabilitar datas inválidas em datepicker
- Confirmação antes de ações destrutivas
- Validação em tempo real
- Sugestões de autocomplete

**Cenários de Teste**:
```gherkin
Cenário: Prevenção de data inválida
  Dado que seleciono data de entrega
  Quando abro o calendário
  Então datas passadas devem estar desabilitadas
  E feriados devem estar marcados

Cenário: Confirmação de exclusão em massa
  Dado que seleciono 50 itens
  Quando clico em "Excluir"
  Então devo ver "Deseja excluir 50 itens?"
  E devo digitar "CONFIRMAR" para prosseguir
```

**Defeitos Típicos**:
- Permitir selecionar opções inválidas
- Exclusão sem confirmação
- Submit duplicado possível

---

### 6. Reconhecimento ao Invés de Lembrança

**Princípio**: Minimize a carga de memória do usuário tornando objetos, ações e opções visíveis. O usuário não deve ter que lembrar informações.

**Exemplos de Conformidade**:
- Buscas recentes
- Itens visualizados recentemente
- Dicas de contexto em campos
- Breadcrumbs de navegação

**Cenários de Teste**:
```gherkin
Cenário: Histórico de buscas
  Dado que fiz 3 buscas anteriormente
  Quando clico no campo de busca
  Então devo ver minhas buscas recentes

Cenário: Placeholder com exemplo
  Dado que vejo o campo de CPF
  Quando está vazio
  Então devo ver placeholder "000.000.000-00"
```

**Defeitos Típicos**:
- Códigos sem descrição
- Campo sem placeholder/label
- Navegação sem breadcrumb

---

### 7. Flexibilidade e Eficiência de Uso

**Princípio**: Aceleradores — invisíveis para o usuário novato — podem frequentemente acelerar a interação para o usuário experiente.

**Exemplos de Conformidade**:
- Atalhos de teclado
- Gestos em mobile
- Favoritos/atalhos personalizáveis
- Modo avançado/simplificado

**Cenários de Teste**:
```gherkin
Cenário: Atalho de teclado para ação frequente
  Dado que estou em qualquer tela
  Quando pressiono Ctrl+K
  Então devo ver a barra de busca global

Cenário: Ação rápida em lista
  Dado que vejo uma lista de itens
  Quando pressiono "E" sobre um item
  Então devo entrar em modo de edição
```

**Defeitos Típicos**:
- Sem atalhos de teclado
- Muitos clicks para ações frequentes
- Sem opção de personalização

---

### 8. Design Estético e Minimalista

**Princípio**: Diálogos não devem conter informação irrelevante ou raramente necessária. Cada unidade extra de informação compete com as unidades relevantes.

**Exemplos de Conformidade**:
- Interface limpa e focada
- Informações secundárias em detalhes expandíveis
- Whitespace adequado
- Hierarquia visual clara

**Cenários de Teste**:
```gherkin
Cenário: Informação essencial visível
  Dado que vejo um card de produto
  Quando faço uma varredura rápida
  Então devo ver: nome, preço, disponibilidade
  E detalhes técnicos devem estar em "Mais detalhes"

Cenário: Formulário sem campos desnecessários
  Dado que preencho cadastro rápido
  Quando vejo os campos obrigatórios
  Então devem ser no máximo 5 campos
```

**Defeitos Típicos**:
- Excesso de informação na tela
- Campos opcionais misturados com obrigatórios
- Layout poluído

---

### 9. Ajudar Usuários a Reconhecer, Diagnosticar e Recuperar de Erros

**Princípio**: Mensagens de erro devem ser expressas em linguagem simples (sem códigos), indicar precisamente o problema e sugerir uma solução construtiva.

**Exemplos de Conformidade**:
- "Email já cadastrado. Deseja recuperar senha?"
- "CEP não encontrado. Verifique os números."
- Link para suporte em erros críticos

**Cenários de Teste**:
```gherkin
Cenário: Mensagem de erro acionável
  Dado que tento cadastrar email já existente
  Quando vejo o erro
  Então a mensagem deve explicar o problema
  E deve oferecer ação (login ou recuperar senha)

Cenário: Erro de validação específico
  Dado que informo CPF inválido
  Quando vejo o erro
  Então deve dizer "CPF inválido - verifique os dígitos"
  E não "Erro no campo documento"
```

**Defeitos Típicos**:
- "Erro 500" sem explicação
- "Dados inválidos" sem especificar qual
- Sem sugestão de correção

---

### 10. Ajuda e Documentação

**Princípio**: Mesmo que seja melhor que o sistema possa ser usado sem documentação, pode ser necessário fornecer ajuda. A informação deve ser fácil de buscar, focada na tarefa e listar passos concretos.

**Exemplos de Conformidade**:
- Tooltips em ícones
- Tour guiado para novos usuários
- FAQ acessível
- Chat de suporte

**Cenários de Teste**:
```gherkin
Cenário: Tooltip em ícones
  Dado que vejo um ícone não óbvio
  Quando passo o mouse sobre ele
  Então devo ver tooltip explicativo

Cenário: Ajuda contextual
  Dado que estou em uma tela complexa
  Quando clico no ícone de ajuda
  Então devo ver documentação específica desta tela
```

**Defeitos Típicos**:
- Ícones sem tooltip
- Documentação desatualizada
- Ajuda genérica não contextual

---

## Template de Avaliação Heurística

| # | Heurística | Severidade | Problema | Recomendação |
|---|------------|------------|----------|--------------|
| 1 | Visibilidade | Alta | Sem feedback de loading | Adicionar spinner |
| 4 | Consistência | Média | Botões com cores diferentes | Padronizar cores |
| 9 | Erros | Alta | Mensagem "Erro 500" | Traduzir para linguagem do usuário |

### Escala de Severidade

| Nível | Descrição |
|-------|-----------|
| 0 | Não é problema de usabilidade |
| 1 | Cosmético - corrigir se houver tempo |
| 2 | Menor - baixa prioridade |
| 3 | Maior - alta prioridade |
| 4 | Catastrófico - imperativo corrigir |

## Referência

Nielsen, J. (1994). 10 Usability Heuristics for User Interface Design
https://www.nngroup.com/articles/ten-usability-heuristics/

