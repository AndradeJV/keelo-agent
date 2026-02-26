import { config, logger } from '../config/index.js';
import { runWeeklyQualityReport } from './weekly-quality-report.js';

let timer: NodeJS.Timeout | null = null;
let lastRunKey = '';

function getTimeParts(now: Date, timeZone: string): {
  day: number;
  hour: number;
  minute: number;
  runKey: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string): string => parts.find((part) => part.type === type)?.value || '';

  const weekday = getPart('weekday');
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const month = getPart('month');
  const day = getPart('day');
  const year = getPart('year');
  const hour = Number(getPart('hour'));
  const minute = Number(getPart('minute'));
  return {
    day: dayMap[weekday] ?? 0,
    hour,
    minute,
    runKey: `${year}-${month}-${day}`,
  };
}

export function startWeeklyReportScheduler(): void {
  if (!config.reports.weekly.enabled) {
    logger.info('Weekly quality report scheduler disabled');
    return;
  }

  if (timer) {
    clearInterval(timer);
  }

  timer = setInterval(async () => {
    try {
      const current = getTimeParts(new Date(), config.reports.weekly.timezone);
      const shouldRun =
        current.day === config.reports.weekly.day &&
        current.hour === config.reports.weekly.hour &&
        current.minute === config.reports.weekly.minute &&
        current.runKey !== lastRunKey;

      if (!shouldRun) {
        return;
      }

      await runWeeklyQualityReport();
      lastRunKey = current.runKey;
    } catch (error) {
      logger.error({ error }, 'Weekly quality report scheduler tick failed');
    }
  }, 60_000);

  logger.info(
    {
      timezone: config.reports.weekly.timezone,
      day: config.reports.weekly.day,
      hour: config.reports.weekly.hour,
      minute: config.reports.weekly.minute,
    },
    'Weekly quality report scheduler started'
  );
}

