import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

// =============================================================================
// Types
// =============================================================================

export type TriggerSource = 'auto' | 'command' | 'silent';

export interface Analysis {
  id: string;
  type: 'pr' | 'requirements' | 'figma' | 'user_story';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  version?: string;
  trigger_source?: TriggerSource;
  repository?: string;
  pr_number?: number;
  pr_title?: string;
  pr_url?: string;
  feature_name?: string;
  project_name?: string;
  overall_risk?: 'critical' | 'high' | 'medium' | 'low';
  summary_title?: string;
  scenarios_count: number;
  risks_count: number;
  gaps_count: number;
  criteria_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface Notification {
  id: string;
  type: 'analysis_complete' | 'analysis_failed' | 'critical_risk';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  analysisId?: string;
}

export interface Stats {
  totalAnalyses: number;
  prAnalyses: number;
  requirementsAnalyses: number;
  completed: number;
  failed: number;
  avgScenarios: number;
  avgRisks: number;
  criticalCount: number;
  highCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface RealtimeState {
  socket: Socket | null;
  isConnected: boolean;
  analyses: Analysis[];
  stats: Stats | null;
  notifications: Notification[];
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  setAnalyses: (analyses: Analysis[]) => void;
  addAnalysis: (analysis: Analysis) => void;
  updateAnalysis: (id: string, data: Partial<Analysis>) => void;
  setStats: (stats: Stats) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

// =============================================================================
// Store
// =============================================================================

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  socket: null,
  isConnected: false,
  analyses: [],
  stats: null,
  notifications: [],

  connect: () => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    // In development, connect to localhost:80 (or VITE_API_URL)
    // In production, connect to same origin
    const apiPort = import.meta.env.VITE_API_PORT || '80';
    const wsUrl = import.meta.env.VITE_API_URL || 
      (import.meta.env.DEV ? `http://localhost:${apiPort}` : window.location.origin);

    console.log('🔌 Connecting to WebSocket at:', wsUrl);

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      set({ isConnected: false });
    });

    socket.on('analysis:new', (analysis: Partial<Analysis>) => {
      console.log('📥 Received analysis:new', analysis);
      
      // Build PR URL if we have repository and pr_number
      const prUrl = analysis.pr_url || 
        (analysis.repository && analysis.pr_number 
          ? `https://github.com/${analysis.repository}/pull/${analysis.pr_number}`
          : undefined);
      
      const fullAnalysis: Analysis = {
        id: analysis.id || `temp-${Date.now()}`,
        type: analysis.type || 'pr',
        status: analysis.status || 'processing',
        repository: analysis.repository,
        pr_number: analysis.pr_number,
        pr_title: analysis.pr_title,
        pr_url: prUrl,
        feature_name: analysis.feature_name,
        project_name: analysis.project_name,
        overall_risk: analysis.overall_risk,
        summary_title: analysis.summary_title,
        scenarios_count: analysis.scenarios_count || 0,
        risks_count: analysis.risks_count || 0,
        gaps_count: analysis.gaps_count || 0,
        created_at: analysis.created_at || new Date().toISOString(),
        completed_at: analysis.completed_at,
      };
      get().addAnalysis(fullAnalysis);
      get().addNotification({
        type: 'analysis_complete',
        title: 'Nova Análise',
        message: `Análise ${fullAnalysis.type === 'pr' ? 'de PR' : 'de requisitos'} iniciada`,
        analysisId: fullAnalysis.id,
      });
    });

    socket.on('analysis:update', (data: { id: string; data: Partial<Analysis> }) => {
      console.log('📥 Received analysis:update', data);
      get().updateAnalysis(data.id, data.data);
      
      // Get updated analysis from store
      const analysis = get().analyses.find((a) => a.id === data.id);
      const risk = data.data.overall_risk || analysis?.overall_risk;
      
      if (data.data.status === 'completed') {
        if (risk === 'critical') {
          get().addNotification({
            type: 'critical_risk',
            title: '⚠️ Risco Crítico',
            message: `Análise ${analysis?.pr_title || analysis?.feature_name || 'PR'} detectou risco crítico`,
            analysisId: data.id,
          });
        } else {
          get().addNotification({
            type: 'analysis_complete',
            title: 'Análise Concluída',
            message: `${analysis?.pr_title || analysis?.feature_name || 'Análise'} finalizada`,
            analysisId: data.id,
          });
        }
      } else if (data.data.status === 'failed') {
        get().addNotification({
          type: 'analysis_failed',
          title: 'Análise Falhou',
          message: data.data.error_message || 'Ocorreu um erro durante a análise',
          analysisId: data.id,
        });
      }
    });

    socket.on('notification', (notification: { type: string; title: string; message: string; analysisId?: string }) => {
      console.log('📥 Received notification', notification);
      get().addNotification({
        type: notification.type as Notification['type'],
        title: notification.title,
        message: notification.message,
        analysisId: notification.analysisId,
      });
    });

    socket.on('stats:update', (stats: Stats) => {
      set({ stats });
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setAnalyses: (analyses) => set({ analyses }),

  addAnalysis: (analysis) =>
    set((state) => ({
      analyses: [analysis, ...state.analyses].slice(0, 100),
    })),

  updateAnalysis: (id, data) =>
    set((state) => ({
      analyses: state.analyses.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),

  setStats: (stats) => set({ stats }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: `notif-${Date.now()}`,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, 50),
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));

