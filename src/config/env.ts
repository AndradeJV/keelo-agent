import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  GITHUB_APP_ID: z.string().min(1, 'GITHUB_APP_ID is required'),
  GITHUB_PRIVATE_KEY: z.string().min(1, 'GITHUB_PRIVATE_KEY is required'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
  
  // LLM API Keys (at least one required)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Figma API (optional - for auto-fetching designs)
  FIGMA_ACCESS_TOKEN: z.string().optional(),
  
  // Database (optional - history features)
  DATABASE_URL: z.string().optional(),

  // Governance/trigger hardening
  KEELO_ENFORCE_HYBRID: z.enum(['true', 'false']).default('false'),

  // Jira integration (read-only metrics)
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_EMAIL: z.string().optional(),
  JIRA_API_TOKEN: z.string().optional(),
  JIRA_PROJECT_KEY: z.string().optional(),
  JIRA_BUGS_JQL: z.string().optional(),
  JIRA_CAUGHT_LABEL: z.string().default('caught-pre-prod'),
  JIRA_ESCAPED_LABEL: z.string().default('escaped-prod'),

  // Weekly quality report scheduler
  WEEKLY_REPORT_ENABLED: z.enum(['true', 'false']).default('true'),
  WEEKLY_REPORT_DAY: z.string().default('5'),
  WEEKLY_REPORT_HOUR: z.string().default('18'),
  WEEKLY_REPORT_MINUTE: z.string().default('0'),
  WEEKLY_REPORT_TIMEZONE: z.string().default('America/Sao_Paulo'),
  SLACK_WEBHOOK_URL: z.string().optional(),
  
  PORT: z.string().default('3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

// Validate that at least one LLM API key is provided
if (!parsed.data.OPENAI_API_KEY && !parsed.data.ANTHROPIC_API_KEY) {
  console.error('❌ At least one LLM API key is required (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
  process.exit(1);
}

export const config = {
  github: {
    appId: parsed.data.GITHUB_APP_ID,
    privateKey: parsed.data.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
    webhookSecret: parsed.data.GITHUB_WEBHOOK_SECRET,
  },
  figma: {
    accessToken: parsed.data.FIGMA_ACCESS_TOKEN || '',
  },
  llm: {
    openai: {
      apiKey: parsed.data.OPENAI_API_KEY || '',
    },
    anthropic: {
      apiKey: parsed.data.ANTHROPIC_API_KEY || '',
    },
  },
  server: {
    port: parseInt(parsed.data.PORT, 10),
    logLevel: parsed.data.LOG_LEVEL,
    enforceHybridTrigger: parsed.data.KEELO_ENFORCE_HYBRID === 'true',
  },
  jira: {
    baseUrl: parsed.data.JIRA_BASE_URL || '',
    email: parsed.data.JIRA_EMAIL || '',
    apiToken: parsed.data.JIRA_API_TOKEN || '',
    projectKey: parsed.data.JIRA_PROJECT_KEY || '',
    bugsJql: parsed.data.JIRA_BUGS_JQL || '',
    labels: {
      caughtPreProd: parsed.data.JIRA_CAUGHT_LABEL,
      escapedProd: parsed.data.JIRA_ESCAPED_LABEL,
    },
  },
  reports: {
    weekly: {
      enabled: parsed.data.WEEKLY_REPORT_ENABLED === 'true',
      day: parseInt(parsed.data.WEEKLY_REPORT_DAY, 10),
      hour: parseInt(parsed.data.WEEKLY_REPORT_HOUR, 10),
      minute: parseInt(parsed.data.WEEKLY_REPORT_MINUTE, 10),
      timezone: parsed.data.WEEKLY_REPORT_TIMEZONE,
    },
  },
} as const;

export type Config = typeof config;
