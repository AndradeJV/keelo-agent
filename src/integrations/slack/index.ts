/**
 * Slack Integration Module
 * 
 * Slack notification handling:
 * - Webhook notifications
 * - Message formatting
 * - Event-based notifications
 */

export {
  sendSlackNotification,
  notifySlack,
  notifyRequirementsAnalysisComplete,
  sendActionReport,
  sendQAHealthReport,
  sendWeeklyQualityReport,
  sendCIStatusUpdate,
  sendProductImpactNotification,
  buildAnalysisNotification,
  buildTestPRNotification,
  buildCIFailureNotification,
  buildCriticalRiskNotification,
  buildRequirementsAnalysisNotification,
  buildActionReportNotification,
  buildQAHealthReportNotification,
  buildWeeklyQualityReportNotification,
  buildCIStatusNotification,
  buildProductImpactNotification,
  type SlackConfig,
  type RequirementsAnalysisNotificationData,
  type KeeloActionReport,
  type QAHealthReport,
  type WeeklyQualityReport,
  type CIStatusUpdate,
  type ProductImpactNotificationData,
} from './client.js';

