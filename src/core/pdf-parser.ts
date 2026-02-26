import { logger } from '../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface ParsedPDF {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pages?: number;
  };
  sections: PDFSection[];
}

export interface PDFSection {
  title?: string;
  content: string;
  page?: number;
}

// =============================================================================
// PDF Parsing (usando pdf-parse quando disponível)
// =============================================================================

/**
 * Parse PDF from base64 string
 * 
 * Nota: Para parsing completo, instale pdf-parse:
 * npm install pdf-parse
 */
export async function parsePDFFromBase64(base64Content: string): Promise<ParsedPDF> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Content.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    return await parsePDFBuffer(buffer);
  } catch (error) {
    logger.error({ error }, 'Falha ao parsear PDF de base64');
    throw new Error('Não foi possível parsear o PDF');
  }
}

/**
 * Parse PDF from buffer
 */
export async function parsePDFBuffer(buffer: Buffer): Promise<ParsedPDF> {
  try {
    // Tenta usar pdf-parse se disponível
    const pdfParse = await tryImportPdfParse();
    
    if (pdfParse) {
      const data = await pdfParse(buffer);
      
      return {
        content: data.text,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          pages: data.numpages,
        },
        sections: extractSections(data.text),
      };
    }
    
    // Fallback: extração básica de texto
    return extractTextFallback(buffer);
  } catch (error) {
    logger.error({ error }, 'Falha ao parsear buffer do PDF');
    throw new Error('Não foi possível parsear o PDF');
  }
}

/**
 * Interface para pdf-parse (opcional)
 */
interface PDFParseResult {
  text: string;
  numpages: number;
  info: Record<string, string>;
}

type PDFParseFunction = (buffer: Buffer) => Promise<PDFParseResult>;

/**
 * Tenta importar pdf-parse dinamicamente
 * 
 * Para usar parsing completo, instale: npm install pdf-parse @types/pdf-parse
 */
async function tryImportPdfParse(): Promise<PDFParseFunction | null> {
  try {
    // Dynamic import usando eval para evitar erro de compilação
    // quando pdf-parse não está instalado
    const dynamicImport = new Function('moduleName', 'return import(moduleName)');
    const pdfParseModule = await dynamicImport('pdf-parse') as { default: PDFParseFunction };
    return pdfParseModule.default;
  } catch {
    logger.warn('pdf-parse não está instalado. Usando extração básica de texto.');
    logger.warn('Para melhor suporte a PDF, execute: npm install pdf-parse');
    return null;
  }
}

/**
 * Fallback para extração de texto sem pdf-parse
 */
function extractTextFallback(buffer: Buffer): ParsedPDF {
  // Extração muito básica de texto de PDF
  // Procura por strings de texto no buffer
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000));
  
  // Tenta extrair texto visível (muito simplificado)
  const textMatches = content.match(/\((.*?)\)/g) || [];
  const extractedText = textMatches
    .map(m => m.slice(1, -1))
    .filter(t => t.length > 1 && /[a-zA-Z]/.test(t))
    .join(' ');
  
  return {
    content: extractedText || 'Conteúdo do PDF não pôde ser extraído. Instale pdf-parse para melhor suporte.',
    metadata: {},
    sections: [],
  };
}

/**
 * Extrai seções do texto do PDF
 */
function extractSections(text: string): PDFSection[] {
  const sections: PDFSection[] = [];
  const lines = text.split('\n');
  
  let currentSection: PDFSection = { content: '' };
  
  for (const line of lines) {
    // Detecta possíveis títulos de seção
    const trimmed = line.trim();
    
    if (isLikelySectionTitle(trimmed)) {
      // Salva seção anterior se tiver conteúdo
      if (currentSection.content.trim()) {
        sections.push(currentSection);
      }
      
      currentSection = {
        title: trimmed,
        content: '',
      };
    } else {
      currentSection.content += line + '\n';
    }
  }
  
  // Adiciona última seção
  if (currentSection.content.trim() || currentSection.title) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Detecta se uma linha é provavelmente um título de seção
 */
function isLikelySectionTitle(line: string): boolean {
  if (!line || line.length < 3 || line.length > 100) return false;
  
  // Padrões comuns de títulos
  const patterns = [
    /^(\d+\.)+\s+\w/,           // 1. Título, 1.1 Subtítulo
    /^[A-Z][A-Z\s]+$/,          // TÍTULO EM MAIÚSCULAS
    /^(Capítulo|Seção|Parte|Section|Chapter)/i,
    /^(Introdução|Conclusão|Resumo|Abstract|Introduction|Conclusion)/i,
    /^(Requisitos?|Requirements?|História|Story|Critérios?|Criteria)/i,
    /^(Objetivo|Escopo|Scope|Goal|Funcionalidades|Features)/i,
  ];
  
  return patterns.some(p => p.test(line));
}

// =============================================================================
// Content Extraction Utilities
// =============================================================================

/**
 * Extrai user stories do conteúdo
 */
export function extractUserStories(content: string): string[] {
  const stories: string[] = [];
  
  // Padrões de user story
  const patterns = [
    /como\s+(?:um|uma)\s+(.+?),?\s+(?:eu\s+)?(?:quero|desejo|preciso)\s+(.+?),?\s+para\s+(.+?)(?:\.|$)/gi,
    /as\s+(?:a|an)\s+(.+?),?\s+i\s+want\s+(.+?),?\s+so\s+that\s+(.+?)(?:\.|$)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      stories.push(match[0]);
    }
  }
  
  return stories;
}

/**
 * Extrai critérios de aceite do conteúdo
 */
export function extractAcceptanceCriteria(content: string): string[] {
  const criteria: string[] = [];
  
  // Padrões de critério de aceite
  const patterns = [
    /(?:dado|given)\s+(.+?)\s+(?:quando|when)\s+(.+?)\s+(?:então|then)\s+(.+?)(?:\.|$)/gi,
    /(?:critério|criterion|ac)\s*(?:\d+)?[:\-]?\s*(.+?)(?:\n|$)/gi,
    /(?:deve|should|must)\s+(.+?)(?:\.|$)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      criteria.push(match[0]);
    }
  }
  
  return criteria;
}

/**
 * Limpa e normaliza o conteúdo extraído
 */
export function normalizeContent(content: string): string {
  return content
    .replace(/\s+/g, ' ')           // Múltiplos espaços -> um espaço
    .replace(/\n{3,}/g, '\n\n')     // Múltiplas quebras -> duas
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '') // Remove caracteres inválidos
    .trim();
}

