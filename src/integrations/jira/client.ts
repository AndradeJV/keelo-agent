import { config, logger } from '../../config/index.js';

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  labels: string[];
  createdAt: string;
  resolvedAt: string | null;
}

interface JiraSearchResponse {
  issues: Array<{
    key: string;
    fields: {
      summary: string;
      created: string;
      resolutiondate: string | null;
      labels?: string[];
      status?: { name: string };
    };
  }>;
}

export function isJiraConfigured(): boolean {
  return Boolean(config.jira.baseUrl && config.jira.email && config.jira.apiToken);
}

function buildDefaultJql(): string {
  if (config.jira.bugsJql) {
    return config.jira.bugsJql;
  }

  if (config.jira.projectKey) {
    return `project = "${config.jira.projectKey}" AND issuetype = Bug ORDER BY created DESC`;
  }

  return 'issuetype = Bug ORDER BY created DESC';
}

export async function fetchJiraBugsForPeriod(
  periodStartISO: string,
  periodEndISO: string
): Promise<JiraIssue[]> {
  if (!isJiraConfigured()) {
    return [];
  }

  const baseJql = buildDefaultJql();
  const jql = `${baseJql} AND created >= "${periodStartISO}" AND created <= "${periodEndISO}"`;
  const url = new URL(`${config.jira.baseUrl}/rest/api/3/search/jql`);
  url.searchParams.set('jql', jql);
  url.searchParams.set('fields', 'summary,status,labels,created,resolutiondate');
  url.searchParams.set('maxResults', '100');

  try {
    const auth = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString('base64');
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Jira fetch failed');
      return [];
    }

    const data = (await response.json()) as JiraSearchResponse;
    return data.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      labels: issue.fields.labels || [],
      createdAt: issue.fields.created,
      resolvedAt: issue.fields.resolutiondate,
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Jira bugs');
    return [];
  }
}

