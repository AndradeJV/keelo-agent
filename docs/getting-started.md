# Primeiros Passos

Após a instalação, siga este guia para configurar o Keelo no seu projeto.

## 1. Configurar GitHub App

### Criar o App

1. Vá para Settings → Developer Settings → GitHub Apps
2. Clique em "New GitHub App"
3. Configure:

```yaml
Nome: Keelo QA (ou seu nome)
Homepage URL: https://your-domain.com
Webhook URL: https://your-domain.com/webhook
Webhook Secret: [gere um secret seguro]

Permissões:
  Repository:
    - Contents: Read & Write
    - Issues: Read & Write
    - Pull requests: Read & Write
    - Checks: Read & Write
  
  Subscribe to events:
    - Issue comment
    - Pull request
    - Push
```

4. Após criar, copie o **App ID**
5. Gere uma **Private Key** e baixe o arquivo

### Configurar no .env

```env
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=seu_secret
```

### Instalar no Repositório

1. Vá para o GitHub App criado
2. Clique em "Install App"
3. Selecione o repositório desejado

## 2. Testar Análise de PR

### Modo Automático (padrão)

1. Abra um novo PR no repositório
2. Aguarde ~30 segundos
3. O Keelo irá comentar no PR com a análise

### Modo Comando

Se configurou `trigger: command`:

1. Abra um PR
2. Comente: `/keelo analyze`
3. Aguarde a análise

### Via Dashboard

1. Acesse http://localhost:3001
2. Clique em **Análise de PR**
3. Cole a URL do PR
4. Clique em **Analisar**

## 3. Testar Análise de Requisitos

1. Acesse o Dashboard
2. Clique em **Left Testing**
3. Cole texto ou URL do Figma/PDF
4. Clique em **Analisar**

O Keelo irá:
- Identificar gaps nos requisitos
- Sugerir critérios de aceite
- Gerar cenários de teste

## 4. Configurar Slack (Opcional)

1. Crie um [Incoming Webhook](https://api.slack.com/messaging/webhooks) no Slack
2. Copie a URL do webhook
3. No Dashboard, vá em **Configurações**
4. Habilite Slack e cole a URL
5. Salve

Agora você receberá notificações no canal configurado.

## 5. Testar Runtime Explorer

### Pré-requisitos

Configure as credenciais no `.env`:

```env
STAGING_USER=seu_email@empresa.com
STAGING_PASS=sua_senha
```

### Executar Manualmente

```bash
npx tsx scripts/run-smart-agent.ts https://seu-app.com --flows=1 --visible
```

### Via Dashboard

1. Vá em **Runtime**
2. Clique em **Executar Agora**
3. Acompanhe os logs em tempo real

## 6. Ver Métricas

1. Acesse o **Dashboard** (página inicial)
2. Veja:
   - Total de análises
   - Riscos detectados
   - Testes gerados
   - Hot spots do código

## Fluxo Típico de Uso

```
┌──────────────────────────────────────────────────────────────┐
│                    CICLO DE QA COM KEELO                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   1. REQUISITOS (Left Testing)                              │
│   ├── PO escreve user story                                 │
│   ├── Keelo analisa gaps e riscos                           │
│   └── Gera cenários de teste                                │
│                                                              │
│   2. DESENVOLVIMENTO                                        │
│   ├── Dev implementa                                        │
│   └── Abre PR                                               │
│                                                              │
│   3. ANÁLISE DE PR (Right Testing)                          │
│   ├── Keelo analisa automaticamente                         │
│   ├── Detecta riscos no código                              │
│   ├── Gera testes automatizados                             │
│   └── Abre PR com testes                                    │
│                                                              │
│   4. RUNTIME (Produção)                                     │
│   ├── Exploração automática às 3h                           │
│   ├── Detecta bugs em produção                              │
│   └── Notifica no Slack                                     │
│                                                              │
│   5. FEEDBACK                                               │
│   ├── Você reage 👍👎 nos comentários                       │
│   └── Keelo aprende e melhora                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Próximos Passos

- [Análise de PRs](./features/pr-analysis.md) - Entenda como funciona
- [Runtime Explorer](./features/runtime-explorer.md) - Exploração automática
- [Comandos /keelo](./reference/commands.md) - Lista de comandos

