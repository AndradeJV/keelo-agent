import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../config/index.js';

let io: Server | null = null;

// =============================================================================
// WebSocket Server
// =============================================================================

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: '/ws',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Client connected to WebSocket');

    // Join rooms based on client preferences
    socket.on('subscribe', (data: { repository?: string }) => {
      if (data.repository) {
        socket.join(`repo:${data.repository}`);
        logger.debug({ socketId: socket.id, repository: data.repository }, 'Client subscribed to repository');
      }
    });

    socket.on('unsubscribe', (data: { repository?: string }) => {
      if (data.repository) {
        socket.leave(`repo:${data.repository}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Client disconnected from WebSocket');
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

// =============================================================================
// Event Emitters
// =============================================================================

export function getIO(): Server | null {
  return io;
}

export function emitAnalysisNew(analysis: {
  id: string;
  type: string;
  status: string;
  repository?: string;
  pr_number?: number;
  feature_name?: string;
  project_name?: string;
  summary_title?: string;
}): void {
  if (!io) return;

  const analysisWithTimestamp = {
    ...analysis,
    created_at: new Date().toISOString(),
    scenarios_count: 0,
    risks_count: 0,
    gaps_count: 0,
  };

  io.emit('analysis:new', analysisWithTimestamp);

  if (analysis.repository) {
    io.to(`repo:${analysis.repository}`).emit('analysis:new', analysisWithTimestamp);
  }

  logger.info({ analysisId: analysis.id, type: analysis.type }, 'Emitted analysis:new');
}

export function emitAnalysisUpdate(
  id: string,
  data: {
    status?: string;
    overall_risk?: string;
    risk_score?: number;
    merge_recommendation?: string;
    scenarios_count?: number;
    risks_count?: number;
    gaps_count?: number;
    summary_title?: string;
    completed_at?: string;
    error_message?: string;
  },
  repository?: string
): void {
  if (!io) return;

  io.emit('analysis:update', { id, data });

  if (repository) {
    io.to(`repo:${repository}`).emit('analysis:update', { id, data });
  }

  logger.debug({ analysisId: id, status: data.status }, 'Emitted analysis:update');
}

export function emitStatsUpdate(stats: {
  totalAnalyses: number;
  prAnalyses: number;
  requirementsAnalyses: number;
  completed: number;
  failed: number;
}): void {
  if (!io) return;

  io.emit('stats:update', stats);
  logger.debug('Emitted stats:update');
}

export function emitNotification(notification: {
  type: 'analysis_complete' | 'analysis_failed' | 'critical_risk';
  title: string;
  message: string;
  analysisId?: string;
  repository?: string;
}): void {
  if (!io) return;

  io.emit('notification', notification);

  if (notification.repository) {
    io.to(`repo:${notification.repository}`).emit('notification', notification);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getConnectedClients(): number {
  if (!io) return 0;
  return io.sockets.sockets.size;
}

