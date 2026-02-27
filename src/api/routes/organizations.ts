import { Router, Request, Response } from 'express';
import { logger } from '../../config/index.js';
import {
  isDatabaseEnabled,
  createOrganization,
  getOrganizationById,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  getOrgMembership,
  transferOwnership,
  updateMemberStatus,
  countOwnedOrganizations,
  getUserOrgCreationLimit,
  findUserByEmail,
  type MemberStatus,
  getOrgProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  userHasProjectAccess,
} from '../../database/index.js';

import { sendOrgInvitationEmail, isEmailEnabled } from '../../services/email.js';

const router = Router();

// =============================================================================
// Middleware
// =============================================================================

function requireDatabase(_req: Request, res: Response, next: () => void) {
  if (!isDatabaseEnabled()) {
    return res.status(503).json({
      error: 'Banco de dados não configurado',
    });
  }
  next();
}

/**
 * Middleware to check org membership and attach org info to request
 */
async function requireOrgAccess(req: Request, res: Response, next: () => void) {
  const orgId = req.params.orgId;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  // Super admin bypasses org check
  if (req.user?.role === 'admin') {
    return next();
  }

  const membership = await getOrgMembership(orgId, userId);
  if (!membership) {
    return res.status(403).json({ error: 'Sem acesso a esta organização' });
  }

  // Attach membership to request for downstream use
  (req as Request & { orgMembership?: typeof membership }).orgMembership = membership;
  next();
}

/**
 * Middleware to check org admin/owner role
 */
async function requireOrgAdmin(req: Request, res: Response, next: () => void) {
  const orgId = req.params.orgId;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  if (req.user?.role === 'admin') {
    return next();
  }

  const membership = await getOrgMembership(orgId, userId);
  if (!membership || membership.role === 'member') {
    return res.status(403).json({ error: 'Permissão de admin necessária' });
  }

  next();
}

// =============================================================================
// Organization Routes
// =============================================================================

/**
 * GET /organizations
 * List all organizations the user belongs to
 */
router.get('/', requireDatabase, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const organizations = await getUserOrganizations(userId);

    res.json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list organizations');
    res.status(500).json({
      error: 'Falha ao listar organizações',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /organizations
 * Create a new organization
 */
router.post('/', requireDatabase, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { name, slug, avatar } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: 'Nome e slug são obrigatórios',
      });
    }

    // Check org creation limit (based on plan)
    if (req.user?.role !== 'admin') {
      const ownedCount = await countOwnedOrganizations(userId);
      const limit = await getUserOrgCreationLimit(userId);
      if (ownedCount >= limit) {
        return res.status(403).json({
          error: 'Limite de organizações atingido',
          message: `Seu plano permite criar até ${limit} organização(ões). Faça upgrade para criar mais.`,
          current: ownedCount,
          limit,
        });
      }
    }

    const org = await createOrganization({
      name,
      slug: slug.toLowerCase(),
      ownerId: userId,
      avatar,
    });

    res.status(201).json({
      success: true,
      data: org,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create organization');
    res.status(400).json({
      error: 'Falha ao criar organização',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /organizations/:orgId
 * Get organization details
 */
router.get('/:orgId', requireDatabase, requireOrgAccess, async (req: Request, res: Response) => {
  try {
    const org = await getOrganizationById(req.params.orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organização não encontrada' });
    }

    res.json({
      success: true,
      data: org,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get organization');
    res.status(500).json({
      error: 'Falha ao buscar organização',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * PATCH /organizations/:orgId
 * Update an organization
 */
router.patch('/:orgId', requireDatabase, requireOrgAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { name, avatar } = req.body;
    const org = await updateOrganization(req.params.orgId, { name, avatar }, userId);

    res.json({
      success: true,
      data: org,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update organization');
    res.status(400).json({
      error: 'Falha ao atualizar organização',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * DELETE /organizations/:orgId
 * Delete an organization (owner only)
 */
router.delete('/:orgId', requireDatabase, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const deleted = await deleteOrganization(req.params.orgId, userId);

    if (deleted) {
      res.json({ success: true, message: 'Organização excluída' });
    } else {
      res.status(404).json({ error: 'Organização não encontrada' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete organization');
    res.status(400).json({
      error: 'Falha ao excluir organização',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// =============================================================================
// Members Routes
// =============================================================================

/**
 * GET /organizations/:orgId/members
 * List all members of an organization
 */
router.get('/:orgId/members', requireDatabase, requireOrgAccess, async (req: Request, res: Response) => {
  try {
    const members = await getOrgMembers(req.params.orgId);

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list members');
    res.status(500).json({
      error: 'Falha ao listar membros',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /organizations/:orgId/members
 * Add a member to an organization (by email)
 */
router.post('/:orgId/members', requireDatabase, requireOrgAdmin, async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    const inviterId = req.user?.id;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        message: 'O usuário precisa fazer login pelo menos uma vez antes de ser adicionado.',
      });
    }

    const member = await addOrgMember({
      organizationId: req.params.orgId,
      userId: user.id,
      role: role || 'member',
      invitedBy: inviterId,
    });

    // Send invitation email
    if (isEmailEnabled()) {
      try {
        const org = await getOrganizationById(req.params.orgId);
        const inviterName = req.user?.name || req.user?.email || 'Alguém';
        const recipientName = user.name || user.email.split('@')[0];
        const orgName = org?.name || 'uma organização';

        await sendOrgInvitationEmail(user.email, recipientName, inviterName, orgName);
        logger.info({ to: user.email, orgId: req.params.orgId }, 'Invitation email sent');
      } catch (emailError) {
        // Don't fail the invite if email fails
        logger.error({ error: emailError }, 'Failed to send invitation email (member was still added)');
      }
    }

    res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to add member');
    res.status(400).json({
      error: 'Falha ao adicionar membro',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * DELETE /organizations/:orgId/members/:userId
 * Remove a member from an organization
 */
router.delete('/:orgId/members/:userId', requireDatabase, requireOrgAdmin, async (req: Request, res: Response) => {
  try {
    const removerId = req.user?.id;
    if (!removerId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const removed = await removeOrgMember(req.params.orgId, req.params.userId, removerId);

    if (removed) {
      res.json({ success: true, message: 'Membro removido' });
    } else {
      res.status(404).json({ error: 'Membro não encontrado' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to remove member');
    res.status(400).json({
      error: 'Falha ao remover membro',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * PATCH /organizations/:orgId/members/:userId/status
 * Update a member's status (admin/owner only)
 */
router.patch('/:orgId/members/:userId/status', requireDatabase, requireOrgAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: MemberStatus };

    if (!status || !['active', 'invited', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido. Use: active, invited, inactive' });
    }

    const updated = await updateMemberStatus(req.params.orgId, req.params.userId, status);

    if (!updated) {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update member status');
    res.status(400).json({
      error: 'Falha ao atualizar status',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /organizations/:orgId/transfer-ownership
 * Transfer ownership to another member (owner only)
 */
router.post('/:orgId/transfer-ownership', requireDatabase, async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { newOwnerId } = req.body;
    if (!newOwnerId) {
      return res.status(400).json({ error: 'ID do novo dono é obrigatório' });
    }

    await transferOwnership(req.params.orgId, currentUserId, newOwnerId);

    res.json({
      success: true,
      message: 'Propriedade transferida com sucesso',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to transfer ownership');
    res.status(400).json({
      error: 'Falha ao transferir propriedade',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

// =============================================================================
// Project Routes (nested under organization)
// =============================================================================

/**
 * GET /organizations/:orgId/projects
 * List all projects in an organization
 */
router.get('/:orgId/projects', requireDatabase, requireOrgAccess, async (req: Request, res: Response) => {
  try {
    const projects = await getOrgProjects(req.params.orgId);

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list projects');
    res.status(500).json({
      error: 'Falha ao listar projetos',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * POST /organizations/:orgId/projects
 * Create a project in an organization
 */
router.post('/:orgId/projects', requireDatabase, requireOrgAccess, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: 'Nome e slug são obrigatórios',
      });
    }

    const project = await createProject({
      organizationId: req.params.orgId,
      name,
      slug: slug.toLowerCase(),
      description,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create project');
    res.status(400).json({
      error: 'Falha ao criar projeto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * GET /organizations/:orgId/projects/:projectId
 * Get a project
 */
router.get('/:orgId/projects/:projectId', requireDatabase, requireOrgAccess, async (req: Request, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId);
    if (!project || project.organization_id !== req.params.orgId) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get project');
    res.status(500).json({
      error: 'Falha ao buscar projeto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * PATCH /organizations/:orgId/projects/:projectId
 * Update a project
 */
router.patch('/:orgId/projects/:projectId', requireDatabase, requireOrgAccess, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const project = await updateProject(req.params.projectId, { name, description });

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update project');
    res.status(400).json({
      error: 'Falha ao atualizar projeto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * DELETE /organizations/:orgId/projects/:projectId
 * Delete a project (admin/owner only)
 */
router.delete('/:orgId/projects/:projectId', requireDatabase, requireOrgAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteProject(req.params.projectId);

    if (deleted) {
      res.json({ success: true, message: 'Projeto excluído' });
    } else {
      res.status(404).json({ error: 'Projeto não encontrado' });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to delete project');
    res.status(400).json({
      error: 'Falha ao excluir projeto',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

export default router;

