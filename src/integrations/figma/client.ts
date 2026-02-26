import { config, logger } from '../../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface FigmaFileInfo {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
}

export interface FigmaImageResult {
  imageBase64: string;
  nodeId: string;
  nodeName?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
  type: 'file' | 'design' | 'proto' | 'board';
}

// =============================================================================
// URL Parser
// =============================================================================

/**
 * Parses Figma URLs to extract file key and node ID
 * Supports multiple URL formats:
 * - https://www.figma.com/file/ABC123/Name
 * - https://www.figma.com/design/ABC123/Name?node-id=1-2
 * - https://www.figma.com/proto/ABC123/Name
 * - https://www.figma.com/board/ABC123/Name
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl | null {
  try {
    const urlObj = new URL(url);
    
    if (!urlObj.hostname.includes('figma.com')) {
      return null;
    }
    
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 2) {
      return null;
    }
    
    const type = pathParts[0] as 'file' | 'design' | 'proto' | 'board';
    const fileKey = pathParts[1];
    
    // Extract node-id from query params
    let nodeId = urlObj.searchParams.get('node-id');
    
    // Figma uses both "1:2" and "1-2" formats
    if (nodeId) {
      nodeId = nodeId.replace('-', ':');
    }
    
    return { fileKey, nodeId: nodeId || undefined, type };
  } catch {
    return null;
  }
}

// =============================================================================
// API Client
// =============================================================================

const FIGMA_API_BASE = 'https://api.figma.com/v1';

async function figmaRequest<T>(endpoint: string): Promise<T> {
  if (!config.figma.accessToken) {
    throw new Error('FIGMA_ACCESS_TOKEN não configurado. Adicione ao arquivo .env');
  }
  
  const response = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    headers: {
      'X-Figma-Token': config.figma.accessToken,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    logger.error({ status: response.status, error }, 'Figma API error');
    
    if (response.status === 403) {
      throw new Error('Acesso negado ao Figma. Verifique se o token tem permissão para este arquivo.');
    }
    if (response.status === 404) {
      throw new Error('Arquivo do Figma não encontrado. Verifique a URL.');
    }
    
    throw new Error(`Figma API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Gets basic file info from Figma
 */
export async function getFileInfo(fileKey: string): Promise<FigmaFileInfo> {
  const data = await figmaRequest<{
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    version: string;
  }>(`/files/${fileKey}?depth=1`);
  
  return {
    name: data.name,
    lastModified: data.lastModified,
    thumbnailUrl: data.thumbnailUrl,
    version: data.version,
  };
}

/**
 * Gets the root frame nodes from a file
 */
export async function getFileFrames(fileKey: string): Promise<Array<{ id: string; name: string; type: string }>> {
  const data = await figmaRequest<{
    document: {
      children: Array<{
        id: string;
        name: string;
        type: string;
        children?: Array<{ id: string; name: string; type: string }>;
      }>;
    };
  }>(`/files/${fileKey}?depth=2`);
  
  const frames: Array<{ id: string; name: string; type: string }> = [];
  
  for (const page of data.document.children) {
    if (page.children) {
      for (const node of page.children) {
        if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          frames.push({
            id: node.id,
            name: node.name,
            type: node.type,
          });
        }
      }
    }
  }
  
  return frames;
}

// =============================================================================
// Image Export
// =============================================================================

/**
 * Exports a node (or entire file) as PNG and returns base64
 */
export async function exportNodeAsImage(
  fileKey: string,
  nodeId?: string,
  options: {
    scale?: number; // 1-4, default 2
    format?: 'png' | 'jpg' | 'svg';
  } = {}
): Promise<FigmaImageResult> {
  const { scale = 2, format = 'png' } = options;
  
  // If no nodeId, get the first frame
  let targetNodeId = nodeId;
  if (!targetNodeId) {
    const frames = await getFileFrames(fileKey);
    if (frames.length === 0) {
      throw new Error('Nenhum frame encontrado no arquivo do Figma');
    }
    targetNodeId = frames[0].id;
    logger.info({ nodeId: targetNodeId, nodeName: frames[0].name }, 'Auto-selected first frame');
  }
  
  // Request image URL from Figma
  const imageData = await figmaRequest<{
    images: Record<string, string | null>;
    err?: string;
  }>(`/images/${fileKey}?ids=${targetNodeId}&scale=${scale}&format=${format}`);
  
  if (imageData.err) {
    throw new Error(`Figma image export error: ${imageData.err}`);
  }
  
  const imageUrl = imageData.images[targetNodeId];
  if (!imageUrl) {
    throw new Error('Figma não retornou a imagem. O node pode ser inválido ou vazio.');
  }
  
  // Download the image
  logger.debug({ imageUrl }, 'Downloading Figma image');
  const imageResponse = await fetch(imageUrl);
  
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const mimeType = format === 'jpg' ? 'image/jpeg' : format === 'svg' ? 'image/svg+xml' : 'image/png';
  
  return {
    imageBase64: `data:${mimeType};base64,${base64}`,
    nodeId: targetNodeId,
  };
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Fetches design image from Figma URL automatically
 * This is the main function to use for requirements analysis
 */
export async function fetchDesignFromUrl(figmaUrl: string): Promise<{
  imageBase64: string;
  fileInfo: FigmaFileInfo;
  nodeId?: string;
}> {
  const parsed = parseFigmaUrl(figmaUrl);
  
  if (!parsed) {
    throw new Error('URL do Figma inválida. Use o formato: https://www.figma.com/file/KEY/name ou https://www.figma.com/design/KEY/name');
  }
  
  logger.info({ fileKey: parsed.fileKey, nodeId: parsed.nodeId }, 'Fetching Figma design');
  
  // Get file info and image in parallel
  const [fileInfo, imageResult] = await Promise.all([
    getFileInfo(parsed.fileKey),
    exportNodeAsImage(parsed.fileKey, parsed.nodeId),
  ]);
  
  logger.info({ 
    fileName: fileInfo.name, 
    nodeId: imageResult.nodeId,
    imageSize: Math.round(imageResult.imageBase64.length / 1024) + 'KB'
  }, 'Figma design fetched successfully');
  
  return {
    imageBase64: imageResult.imageBase64,
    fileInfo,
    nodeId: imageResult.nodeId,
  };
}

// =============================================================================
// Health Check
// =============================================================================

export function isFigmaConfigured(): boolean {
  return !!config.figma.accessToken;
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  if (!isFigmaConfigured()) {
    return { success: false, error: 'FIGMA_ACCESS_TOKEN não configurado' };
  }
  
  try {
    // Try to access the API (will fail gracefully if token is invalid)
    await figmaRequest('/me');
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

