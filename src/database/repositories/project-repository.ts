import { query, queryOne, queryAll, isDatabaseEnabled } from '../connection.js';
import { logger } from '../../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface ProjectRecord {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectWithStats extends ProjectRecord {
  analysis_count: number;
  last_analysis_at: string | null;
}

// =============================================================================
// Project CRUD
// =============================================================================

/**
 * Create a project within an organization
 */
export async function createProject(data: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  createdBy: string;
}): Promise<ProjectRecord> {
  if (!isDatabaseEnabled()) throw new Error('Database not enabled');

  // Validate slug format
  const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  if (!slugRegex.test(data.slug)) {
    throw new Error('Slug inválido. Use apenas letras minúsculas, números e hífens.');
  }

  const result = await queryOne<ProjectRecord>(
    `INSERT INTO projects (organization_id, name, slug, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.organizationId, data.name, data.slug, data.description || null, data.createdBy]
  );

  if (!result) throw new Error('Falha ao criar projeto');

  logger.info({ projectId: result.id, orgId: data.organizationId, slug: data.slug }, 'Project created');
  return result;
}

/**
 * Get a project by ID
 */
export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  if (!isDatabaseEnabled()) return null;
  return queryOne<ProjectRecord>('SELECT * FROM projects WHERE id = $1', [id]);
}

/**
 * Get all projects in an organization (with analysis counts)
 */
export async function getOrgProjects(organizationId: string): Promise<ProjectWithStats[]> {
  if (!isDatabaseEnabled()) return [];

  const results = await queryAll<ProjectWithStats>(
    `SELECT 
      p.*,
      COUNT(a.id) as analysis_count,
      MAX(a.created_at) as last_analysis_at
     FROM projects p
     LEFT JOIN analyses a ON a.project_id = p.id
     WHERE p.organization_id = $1
     GROUP BY p.id
     ORDER BY p.name ASC`,
    [organizationId]
  );

  return results.map(r => ({
    ...r,
    analysis_count: parseInt(String(r.analysis_count), 10) || 0,
  }));
}

/**
 * Get a project by slug within an organization
 */
export async function getProjectBySlug(
  organizationId: string,
  slug: string
): Promise<ProjectRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<ProjectRecord>(
    'SELECT * FROM projects WHERE organization_id = $1 AND slug = $2',
    [organizationId, slug]
  );
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  data: { name?: string; description?: string }
): Promise<ProjectRecord | null> {
  if (!isDatabaseEnabled()) return null;

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description);
  }

  if (sets.length === 0) return getProjectById(id);

  params.push(id);
  return queryOne<ProjectRecord>(
    `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
}

/**
 * Delete a project and all its analyses
 */
export async function deleteProject(id: string): Promise<boolean> {
  if (!isDatabaseEnabled()) return false;

  // Clear project_id from analyses (don't delete analyses, just unlink)
  await query('UPDATE analyses SET project_id = NULL WHERE project_id = $1', [id]);

  const result = await queryOne<{ id: string }>(
    'DELETE FROM projects WHERE id = $1 RETURNING id',
    [id]
  );
  return !!result;
}

/**
 * Check if a user has access to a project (through org membership)
 */
export async function userHasProjectAccess(
  projectId: string,
  userId: string
): Promise<boolean> {
  if (!isDatabaseEnabled()) return false;

  const result = await queryOne<{ id: string }>(
    `SELECT p.id FROM projects p
     JOIN org_members om ON om.organization_id = p.organization_id
     WHERE p.id = $1 AND om.user_id = $2`,
    [projectId, userId]
  );
  return !!result;
}

/**
 * Get all projects a user has access to (through their organizations)
 */
export async function getUserProjects(userId: string): Promise<ProjectWithStats[]> {
  if (!isDatabaseEnabled()) return [];

  const results = await queryAll<ProjectWithStats>(
    `SELECT 
      p.*,
      COUNT(a.id) as analysis_count,
      MAX(a.created_at) as last_analysis_at
     FROM projects p
     JOIN org_members om ON om.organization_id = p.organization_id
     LEFT JOIN analyses a ON a.project_id = p.id
     WHERE om.user_id = $1
     GROUP BY p.id
     ORDER BY p.name ASC`,
    [userId]
  );

  return results.map(r => ({
    ...r,
    analysis_count: parseInt(String(r.analysis_count), 10) || 0,
  }));
}

