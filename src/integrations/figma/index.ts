/**
 * Figma Integration Module
 * 
 * Provides automatic fetching of designs from Figma URLs
 * for requirements analysis.
 */

export {
  parseFigmaUrl,
  getFileInfo,
  getFileFrames,
  exportNodeAsImage,
  fetchDesignFromUrl,
  isFigmaConfigured,
  testConnection,
} from './client.js';

export type {
  FigmaFileInfo,
  FigmaImageResult,
  ParsedFigmaUrl,
} from './client.js';

