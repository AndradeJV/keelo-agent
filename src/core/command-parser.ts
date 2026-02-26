/**
 * Keelo Command Parser
 * 
 * Parses slash commands from PR comments.
 * Supported commands:
 * - /keelo analyze - Run risk analysis and generate test scenarios
 * - /keelo generate tests - Generate and create PR with automated tests
 */

export type KeeloCommand = 
  | { type: 'analyze' }
  | { type: 'generate-tests' }
  | { type: 'help' };

/**
 * Parse a comment body for Keelo commands
 * @param commentBody - The raw comment body text
 * @returns The parsed command or null if no command found
 */
export function parseCommand(commentBody: string): KeeloCommand | null {
  if (!commentBody) return null;
  
  // Normalize: trim and lowercase for comparison
  const normalized = commentBody.trim().toLowerCase();
  
  // Check for /keelo commands
  if (!normalized.startsWith('/keelo')) {
    return null;
  }
  
  // /keelo analyze
  if (normalized.startsWith('/keelo analyze') || normalized.startsWith('/keelo analysis')) {
    return { type: 'analyze' };
  }
  
  // /keelo generate tests (with variations)
  if (
    normalized.startsWith('/keelo generate tests') ||
    normalized.startsWith('/keelo generate-tests') ||
    normalized.startsWith('/keelo gen tests') ||
    normalized.startsWith('/keelo tests')
  ) {
    return { type: 'generate-tests' };
  }
  
  // /keelo help
  if (
    normalized.startsWith('/keelo help') || 
    normalized.startsWith('/keelo helper') ||
    normalized === '/keelo'
  ) {
    return { type: 'help' };
  }
  
  return null;
}

/**
 * Generate help message for Keelo commands
 */
export function getHelpMessage(): string {
  return `## 🤖 Keelo - Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| \`/keelo analyze\` | Analisa o PR e identifica riscos, cenários de teste e gaps |
| \`/keelo generate tests\` | Gera testes automatizados e cria PR com os testes |
| \`/keelo help\` | Mostra esta mensagem de ajuda |

### Aliases

| Comando | Alias para |
|---------|------------|
| \`/keelo analysis\` | \`/keelo analyze\` |
| \`/keelo gen tests\` | \`/keelo generate tests\` |
| \`/keelo tests\` | \`/keelo generate tests\` |
| \`/keelo helper\` | \`/keelo help\` |

### Exemplo de Uso

\`\`\`
/keelo analyze
\`\`\`

Após revisar a análise, você pode gerar os testes:

\`\`\`
/keelo generate tests
\`\`\`
`;
}

