# API REST

O Keelo expõe uma API REST para integração.

## Base URL

```
http://localhost:3000
```

## Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

### Webhook (GitHub)

```http
POST /webhook
```

Recebe eventos do GitHub (PR opened, synchronize, issue_comment).

**Headers:**
- `X-GitHub-Event`: Tipo do evento
- `X-Hub-Signature-256`: Assinatura do payload

---

### Análise de Requisitos

```http
POST /analyze/requirements
```

**Body:**
```json
{
  "title": "Cadastro de Usuário",
  "content": "Como usuário, quero me cadastrar...",
  "source": "user_story"
}
```

**Response:**
```json
{
  "id": "abc-123",
  "status": "completed",
  "result": {
    "risks": [...],
    "gaps": [...],
    "scenarios": [...],
    "recommendations": [...]
  }
}
```

---

### Análise de PR (manual)

```http
POST /analyze/pr
```

**Body:**
```json
{
  "prUrl": "https://github.com/owner/repo/pull/42"
}
```

---

### Histórico de Análises

```http
GET /history
```

**Query params:**
- `limit`: Número de resultados (default: 50)
- `offset`: Paginação
- `type`: `pr` ou `requirements`
- `repository`: Filtrar por repo

**Response:**
```json
{
  "data": [
    {
      "id": "abc-123",
      "type": "pr",
      "title": "feat: add login",
      "repository": "owner/repo",
      "created_at": "2026-02-05T10:00:00Z",
      "risk_level": "high"
    }
  ],
  "total": 150
}
```

---

### Detalhes de Análise

```http
GET /history/:id
```

**Response:**
```json
{
  "id": "abc-123",
  "type": "pr",
  "title": "feat: add login",
  "result": {
    "risks": [...],
    "scenarios": [...],
    "tests": [...]
  }
}
```

---

### Repositórios

```http
GET /history/repositories
```

Lista todos os repositórios com análises.

```http
POST /history/repositories
```

Adiciona repositório manualmente.

```http
DELETE /history/repositories/:id
```

Remove repositório.

---

### Configurações

```http
GET /settings
```

Retorna configurações atuais.

```http
PUT /settings
```

Atualiza configurações.

```http
PATCH /settings
```

Atualiza parcialmente.

```http
POST /settings/reset
```

Reseta para padrões.

```http
GET /settings/options
```

Retorna opções válidas para cada campo.

---

### Runtime

```http
GET /runtime/explorations
```

Lista execuções do runtime.

```http
GET /runtime/explorations/:id
```

Detalhes de uma execução.

```http
POST /runtime/trigger
```

Dispara execução manual.

```http
GET /runtime/bugs
```

Lista bugs encontrados.

---

### QA Health

```http
GET /qa-health/metrics
```

Métricas de saúde.

```http
GET /qa-health/coverage
```

Cobertura por área.

```http
GET /qa-health/autonomy
```

Métricas de autonomia.

---

### Hot Spots

```http
GET /history/hotspots
```

Áreas com mais riscos.

---

### Feedback

```http
POST /history/:id/feedback
```

Registra feedback (👍👎).

**Body:**
```json
{
  "reaction": "thumbs_up",
  "comment": "Ótima análise!"
}
```

---

## WebSocket

```
ws://localhost:3000/ws
```

Eventos em tempo real:

```json
{
  "type": "analysis_started",
  "data": {
    "id": "abc-123",
    "title": "feat: add login"
  }
}
```

```json
{
  "type": "analysis_completed",
  "data": {
    "id": "abc-123",
    "result": {...}
  }
}
```

---

## Autenticação

A API não requer autenticação por padrão (uso interno).

Para expor publicamente, configure um proxy reverso com auth.

---

## Rate Limiting

Não implementado por padrão. Configure no proxy se necessário.

---

## Exemplos

### cURL

```bash
# Analisar requisitos
curl -X POST http://localhost:3000/analyze/requirements \
  -H "Content-Type: application/json" \
  -d '{"title":"Login","content":"User story...","source":"user_story"}'

# Listar análises
curl http://localhost:3000/history?limit=10

# Ver configurações
curl http://localhost:3000/settings
```

### JavaScript

```javascript
// Analisar requisitos
const response = await fetch('http://localhost:3000/analyze/requirements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Login',
    content: 'User story...',
    source: 'user_story'
  })
});

const result = await response.json();
console.log(result);
```

## Próximos Passos

- [Comandos /keelo](./commands.md)
- [Configuração](../configuration.md)

