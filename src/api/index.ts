/**
 * API Module
 * 
 * HTTP server and routes for Keelo
 */

export { default as app, startServer } from './server.js';
export {
  initWebSocket,
  getIO,
  emitAnalysisNew,
  emitAnalysisUpdate,
  emitStatsUpdate,
  emitNotification,
  getConnectedClients,
} from './websocket.js';

