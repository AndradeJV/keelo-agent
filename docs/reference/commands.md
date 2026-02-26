# Comandos /keelo

Quando o Keelo está configurado em modo `command`, você pode interagir via comentários no PR.

## Lista de Comandos

| Comando | Descrição |
|---------|-----------|
| `/keelo analyze` | Executa análise completa do PR |
| `/keelo generate tests` | Gera testes para as mudanças |
| `/keelo help` | Mostra lista de comandos |
| `/keelo helper` | Alias para help |

## Uso

### Analisar PR

```
/keelo analyze
```

O Keelo irá:
1. Analisar o diff do PR
2. Identificar riscos
3. Sugerir cenários de teste
4. Comentar no PR com o resultado

### Gerar Testes

```
/keelo generate tests
```

O Keelo irá:
1. Analisar os arquivos alterados
2. Gerar testes automatizados
3. Abrir um PR com os testes
4. Comentar o link do PR criado

### Ajuda

```
/keelo help
```

Exibe:
```markdown
🤖 **Keelo QA Assistant**

Comandos disponíveis:
- `/keelo analyze` - Analisa este PR e identifica riscos
- `/keelo generate tests` - Gera testes automatizados para as mudanças
- `/keelo help` - Mostra esta mensagem

_Powered by Keelo QA_
```

## Configurar Modo Comando

### Via Dashboard

1. Vá em **Configurações**
2. Em "Modo de Trigger", selecione **Via comando (/keelo)**
3. Salve

### Via Banco de Dados

```sql
UPDATE keelo_settings 
SET value = jsonb_set(value, '{trigger}', '"command"')
WHERE key = 'config';
```

## Permissões GitHub

Para o modo comando funcionar, o GitHub App precisa de permissão para:

- **Issue comments**: Read
- **Pull request comments**: Read & Write

E estar inscrito no evento:
- **Issue comment**

## Exemplo de Fluxo

```
1. Dev abre PR #42
   
2. Dev comenta: /keelo analyze
   
3. Keelo responde:
   
   # 🤖 Keelo QA Analysis
   
   ## 📊 Resumo
   - Risco Geral: 🟠 Alto
   - Arquivos: 5
   
   ## 🎯 Riscos
   ...

4. Dev comenta: /keelo generate tests

5. Keelo responde:
   
   ✅ Testes gerados!
   PR criado: #43 (tests: add auth tests)
```

## Dicas

- Espere a análise terminar antes de chamar outro comando
- Você pode chamar `/keelo analyze` várias vezes (após novos commits)
- Apenas membros com permissão de escrita podem usar os comandos

## Próximos Passos

- [API REST](./api.md)
- [Configuração](../configuration.md)

