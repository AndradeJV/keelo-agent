# Testes Não-Funcionais

## Definição

Testes que verificam **como** o sistema funciona, avaliando atributos de qualidade como performance, segurança, usabilidade e confiabilidade. Baseados na ISO 25010.

## Categorias de Teste Não-Funcional

### 1. Testes de Performance

#### Load Testing (Carga)
**Objetivo**: Avaliar comportamento sob carga esperada

```javascript
// Exemplo: k6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,           // 100 usuários simultâneos
  duration: '5m',     // Durante 5 minutos
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% das requests < 500ms
    http_req_failed: ['rate<0.01'],   // < 1% de falhas
  },
};

export default function() {
  const res = http.get('https://api.example.com/products');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

#### Stress Testing
**Objetivo**: Identificar ponto de ruptura do sistema

```
Cenário de Stress:
1. Iniciar com 10 usuários
2. Aumentar 10 usuários a cada minuto
3. Continuar até falha ou degradação severa
4. Documentar ponto de ruptura
5. Verificar recuperação ao reduzir carga
```

#### Spike Testing
**Objetivo**: Avaliar resposta a picos súbitos de tráfego

```
Cenário de Spike:
1. Carga normal: 50 usuários por 2 minutos
2. Spike: 500 usuários instantaneamente
3. Manter spike por 1 minuto
4. Voltar a 50 usuários
5. Verificar tempo de recuperação
```

#### Endurance/Soak Testing
**Objetivo**: Identificar problemas em execução prolongada (memory leaks)

```
Cenário de Endurance:
- Carga: 80% da capacidade máxima
- Duração: 8-24 horas
- Monitorar: Memória, CPU, tempo de resposta
- Alerta: Degradação progressiva
```

### 2. Testes de Segurança

#### OWASP Top 10 Checklist

| # | Vulnerabilidade | Teste |
|---|-----------------|-------|
| A01 | Broken Access Control | Tentar acessar recursos de outros usuários |
| A02 | Cryptographic Failures | Verificar HTTPS, hashing de senhas |
| A03 | Injection | SQL injection, XSS, Command injection |
| A04 | Insecure Design | Análise de arquitetura |
| A05 | Security Misconfiguration | Headers, CORS, permissões |
| A06 | Vulnerable Components | Scan de dependências |
| A07 | Authentication Failures | Força bruta, session fixation |
| A08 | Data Integrity Failures | Deserialização insegura |
| A09 | Logging Failures | Logs sensíveis, ausência de logs |
| A10 | SSRF | Server-Side Request Forgery |

#### Testes de Autenticação

```gherkin
Cenário: Proteção contra força bruta
  Dado que tento login 5 vezes com senha errada
  Quando tento o 6º login
  Então a conta deve ser bloqueada temporariamente
  E devo ver "Conta bloqueada por 15 minutos"

Cenário: Token de sessão seguro
  Dado que faço login com sucesso
  Quando inspeciono o cookie de sessão
  Então deve ter flag HttpOnly
  E deve ter flag Secure
  E deve ter SameSite=Strict
```

### 3. Testes de Usabilidade

#### Métricas de Usabilidade

| Métrica | Descrição | Meta Típica |
|---------|-----------|-------------|
| Task Success Rate | % de tarefas completadas | > 95% |
| Time on Task | Tempo para completar tarefa | < tempo esperado |
| Error Rate | Erros por tarefa | < 2 |
| Learnability | Tempo para aprender | < 5 minutos |
| System Usability Scale (SUS) | Score 0-100 | > 68 (acima da média) |

#### Checklist de Usabilidade

```
- [ ] Navegação intuitiva (máx. 3 clicks para qualquer funcionalidade)
- [ ] Feedback claro para ações (loading, sucesso, erro)
- [ ] Mensagens de erro úteis e acionáveis
- [ ] Consistência visual e de interação
- [ ] Formulários com validação inline
- [ ] Suporte a atalhos de teclado
- [ ] Responsividade em diferentes telas
```

### 4. Testes de Confiabilidade

#### Disponibilidade

```
SLA (Service Level Agreement):
- 99.9% uptime = 8.76 horas de downtime/ano
- 99.99% uptime = 52.6 minutos de downtime/ano
- 99.999% uptime = 5.26 minutos de downtime/ano
```

#### Recovery Testing

```gherkin
Cenário: Recuperação após falha de banco de dados
  Dado que o sistema está funcionando normalmente
  Quando a conexão com banco de dados é perdida
  Então o sistema deve mostrar página de manutenção
  E quando a conexão é restaurada
  Então o sistema deve voltar a funcionar em menos de 30 segundos
```

#### Failover Testing

```
Cenário de Failover:
1. Sistema rodando em servidor primário
2. Forçar falha do servidor primário
3. Verificar switch para servidor secundário
4. Medir tempo de failover (< 30 segundos)
5. Verificar integridade de dados
```

### 5. Testes de Compatibilidade

#### Matriz de Compatibilidade

| Navegador | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| Chrome (últimas 2 versões) | ✓ | ✓ | ✓ |
| Firefox (últimas 2 versões) | ✓ | ✓ | ✓ |
| Safari (últimas 2 versões) | ✓ | ✓ | ✓ |
| Edge (últimas 2 versões) | ✓ | ✓ | ✓ |

#### Resoluções a Testar

```
Mobile: 375x667, 390x844, 412x915
Tablet: 768x1024, 820x1180
Desktop: 1280x720, 1920x1080, 2560x1440
```

### 6. Testes de Acessibilidade

#### WCAG 2.1 Níveis

| Nível | Descrição | Obrigatoriedade |
|-------|-----------|-----------------|
| A | Requisitos básicos | Obrigatório |
| AA | Padrão recomendado | Recomendado (lei em muitos países) |
| AAA | Máxima acessibilidade | Opcional |

#### Checklist WCAG Básico

```
Nível A:
- [ ] Imagens têm texto alternativo
- [ ] Conteúdo navegável por teclado
- [ ] Foco visível em elementos interativos
- [ ] Não depende apenas de cor para informação

Nível AA:
- [ ] Contraste mínimo 4.5:1 para texto normal
- [ ] Contraste mínimo 3:1 para texto grande
- [ ] Zoom até 200% sem perda de funcionalidade
- [ ] Formulários têm labels associados
```

## Métricas Não-Funcionais

| Área | Métrica | Meta |
|------|---------|------|
| Performance | Tempo de resposta P95 | < 500ms |
| Performance | Throughput | > 1000 req/s |
| Segurança | Vulnerabilidades críticas | 0 |
| Usabilidade | SUS Score | > 70 |
| Confiabilidade | MTBF (Mean Time Between Failures) | > 720h |
| Confiabilidade | MTTR (Mean Time To Recovery) | < 30min |

## Referência

- ISO/IEC 25010 (Qualidade de Software)
- OWASP Testing Guide
- WCAG 2.1 Guidelines
- ISTQB Foundation Syllabus Cap. 2.3

