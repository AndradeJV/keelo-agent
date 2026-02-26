export interface DataQualitySignal {
  source: string;
  freshness: 'fresh' | 'stale' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateAcceptanceRate(accepted: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return clampPercentage((accepted / total) * 100);
}

export function buildQualitySignal(
  source: string,
  hasRealSource: boolean,
  stale: boolean,
  extraNotes: string[] = []
): DataQualitySignal {
  if (!hasRealSource) {
    return {
      source,
      freshness: 'unknown',
      confidence: 'low',
      notes: ['No authoritative source configured', ...extraNotes],
    };
  }

  if (stale) {
    return {
      source,
      freshness: 'stale',
      confidence: 'medium',
      notes: ['Source configured but appears stale', ...extraNotes],
    };
  }

  return {
    source,
    freshness: 'fresh',
    confidence: 'high',
    notes: extraNotes,
  };
}

export function getWeeklyWindow(now = new Date()): { startISO: string; endISO: string; reportKey: string } {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);

  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const reportKey = `${startISO.slice(0, 10)}_${endISO.slice(0, 10)}`;
  return { startISO, endISO, reportKey };
}

