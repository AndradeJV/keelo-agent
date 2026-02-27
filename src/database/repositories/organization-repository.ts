import { queryOne, queryAll, isDatabaseEnabled, getPool } from '../connection.js';
import { logger } from '../../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrgMemberRecord {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  invited_by: string | null;
  joined_at: Date;
  // Joined fields
  user_email?: string;
  user_name?: string;
  user_avatar?: string;
}

export interface OrganizationWithRole extends OrganizationRecord {
  member_role: 'owner' | 'admin' | 'member';
  member_count?: number;
  project_count?: number;
}

// =============================================================================
// Organization CRUD
// =============================================================================

/**
 * Create an organization and add the creator as owner
 */
export async function createOrganization(data: {
  name: string;
  slug: string;
  ownerId: string;
  avatar?: string;
}): Promise<OrganizationRecord> {
  if (!isDatabaseEnabled()) throw new Error('Database not enabled');

  // Validate slug format
  const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  if (!slugRegex.test(data.slug)) {
    throw new Error('Slug inválido. Use apenas letras minúsculas, números e hífens.');
  }

  // Check if slug already exists
  const existing = await queryOne<OrganizationRecord>(
    'SELECT * FROM organizations WHERE slug = $1',
    [data.slug]
  );
  if (existing) {
    throw new Error('Já existe uma organização com esse slug.');
  }

  // Create organization
  const org = await queryOne<OrganizationRecord>(
    `INSERT INTO organizations (name, slug, owner_id, avatar)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.name, data.slug, data.ownerId, data.avatar || null]
  );

  if (!org) throw new Error('Falha ao criar organização');

  // Add owner as member
  await queryOne(
    `INSERT INTO org_members (organization_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [org.id, data.ownerId]
  );

  logger.info({ orgId: org.id, slug: org.slug, ownerId: data.ownerId }, 'Organization created');
  return org;
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(id: string): Promise<OrganizationRecord | null> {
  if (!isDatabaseEnabled()) return null;
  return queryOne<OrganizationRecord>('SELECT * FROM organizations WHERE id = $1', [id]);
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
  if (!isDatabaseEnabled()) return null;
  return queryOne<OrganizationRecord>('SELECT * FROM organizations WHERE slug = $1', [slug]);
}

/**
 * Get all organizations a user belongs to (with their role)
 */
export async function getUserOrganizations(userId: string): Promise<OrganizationWithRole[]> {
  if (!isDatabaseEnabled()) return [];

  return queryAll<OrganizationWithRole>(
    `SELECT 
      o.*,
      om.role as member_role,
      (SELECT COUNT(*) FROM org_members WHERE organization_id = o.id) as member_count,
      (SELECT COUNT(*) FROM projects WHERE organization_id = o.id) as project_count
     FROM organizations o
     JOIN org_members om ON om.organization_id = o.id
     WHERE om.user_id = $1
     ORDER BY o.name ASC`,
    [userId]
  );
}

/**
 * Update an organization
 */
export async function updateOrganization(
  id: string,
  data: { name?: string; avatar?: string },
  userId: string
): Promise<OrganizationRecord | null> {
  if (!isDatabaseEnabled()) return null;

  // Check if user is owner or admin
  const membership = await getOrgMembership(id, userId);
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new Error('Sem permissão para editar esta organização');
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.avatar !== undefined) {
    sets.push(`avatar = $${idx++}`);
    params.push(data.avatar);
  }

  if (sets.length === 0) return getOrganizationById(id);

  params.push(id);
  return queryOne<OrganizationRecord>(
    `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
}

/**
 * Delete an organization (only owner)
 */
export async function deleteOrganization(id: string, userId: string): Promise<boolean> {
  if (!isDatabaseEnabled()) return false;

  // Only the owner can delete
  const membership = await getOrgMembership(id, userId);
  if (!membership || membership.role !== 'owner') {
    throw new Error('Apenas o dono pode excluir a organização');
  }

  const result = await queryOne<{ id: string }>(
    'DELETE FROM organizations WHERE id = $1 RETURNING id',
    [id]
  );
  return !!result;
}

// =============================================================================
// Membership Operations
// =============================================================================

/**
 * Get a user's membership in an organization
 */
export async function getOrgMembership(
  organizationId: string,
  userId: string
): Promise<OrgMemberRecord | null> {
  if (!isDatabaseEnabled()) return null;

  return queryOne<OrgMemberRecord>(
    'SELECT * FROM org_members WHERE organization_id = $1 AND user_id = $2',
    [organizationId, userId]
  );
}

/**
 * Get all members of an organization
 */
export async function getOrgMembers(organizationId: string): Promise<OrgMemberRecord[]> {
  if (!isDatabaseEnabled()) return [];

  return queryAll<OrgMemberRecord>(
    `SELECT 
      om.*,
      u.email as user_email,
      u.name as user_name,
      u.avatar as user_avatar
     FROM org_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1
     ORDER BY om.role ASC, u.name ASC`,
    [organizationId]
  );
}

/**
 * Add a member to an organization
 */
export async function addOrgMember(data: {
  organizationId: string;
  userId: string;
  role?: 'admin' | 'member';
  invitedBy?: string;
}): Promise<OrgMemberRecord> {
  if (!isDatabaseEnabled()) throw new Error('Database not enabled');

  const result = await queryOne<OrgMemberRecord>(
    `INSERT INTO org_members (organization_id, user_id, role, invited_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = $3
     RETURNING *`,
    [data.organizationId, data.userId, data.role || 'member', data.invitedBy || null]
  );

  if (!result) throw new Error('Falha ao adicionar membro');

  logger.info({ orgId: data.organizationId, userId: data.userId, role: data.role }, 'Member added to organization');
  return result;
}

/**
 * Remove a member from an organization
 */
export async function removeOrgMember(
  organizationId: string,
  userId: string,
  removedBy: string
): Promise<boolean> {
  if (!isDatabaseEnabled()) return false;

  // Can't remove the owner
  const membership = await getOrgMembership(organizationId, userId);
  if (membership?.role === 'owner') {
    throw new Error('Não é possível remover o dono da organização');
  }

  // Only owner/admin can remove members
  const removerMembership = await getOrgMembership(organizationId, removedBy);
  if (!removerMembership || removerMembership.role === 'member') {
    throw new Error('Sem permissão para remover membros');
  }

  const result = await queryOne<{ id: string }>(
    'DELETE FROM org_members WHERE organization_id = $1 AND user_id = $2 RETURNING id',
    [organizationId, userId]
  );
  return !!result;
}

/**
 * Check if user has access to an organization (is a member)
 */
export async function userHasOrgAccess(organizationId: string, userId: string): Promise<boolean> {
  if (!isDatabaseEnabled()) return false;
  const membership = await getOrgMembership(organizationId, userId);
  return !!membership;
}

/**
 * Transfer ownership of an organization to another member.
 * The current owner becomes admin, the new owner becomes owner.
 * Uses a database transaction to ensure atomicity.
 */
export async function transferOwnership(
  organizationId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<void> {
  if (!isDatabaseEnabled()) throw new Error('Database not enabled');

  // Verify current user is the owner
  const currentMembership = await getOrgMembership(organizationId, currentOwnerId);
  if (!currentMembership || currentMembership.role !== 'owner') {
    throw new Error('Apenas o dono atual pode transferir a propriedade');
  }

  // Verify new owner is a member
  const newOwnerMembership = await getOrgMembership(organizationId, newOwnerId);
  if (!newOwnerMembership) {
    throw new Error('O novo dono precisa ser membro da organização');
  }

  // Can't transfer to yourself
  if (currentOwnerId === newOwnerId) {
    throw new Error('Você já é o dono desta organização');
  }

  const pool = getPool();
  if (!pool) throw new Error('Database pool not available');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update organization owner_id
    await client.query(
      'UPDATE organizations SET owner_id = $1 WHERE id = $2',
      [newOwnerId, organizationId]
    );

    // 2. Demote current owner to admin
    await client.query(
      `UPDATE org_members SET role = 'admin' WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, currentOwnerId]
    );

    // 3. Promote new owner
    await client.query(
      `UPDATE org_members SET role = 'owner' WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, newOwnerId]
    );

    await client.query('COMMIT');

    logger.info(
      { orgId: organizationId, from: currentOwnerId, to: newOwnerId },
      'Organization ownership transferred'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error, orgId: organizationId }, 'Failed to transfer ownership');
    throw error;
  } finally {
    client.release();
  }
}

