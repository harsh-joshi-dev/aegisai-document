/**
 * API endpoints for custom risk rules
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createRule,
  evaluateRules,
  CustomRule,
} from '../rules/ruleEngine.js';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { deleteCustomRule, insertCustomRule, listCustomRules, updateCustomRule } from '../db/pgvector.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';
import {
  createDynamicRule,
  getDynamicRulesByTenant,
  getDynamicRuleById,
  updateDynamicRule,
  deleteDynamicRule,
} from '../risk/db.js';
import { ensureDefaultRules, syncDefaultRules } from '../risk/service.js';
import type { RuleType, Severity } from '../risk/types.js';
import { getDefaultRuleChangelog } from '../risk/ruleEngine.js';

const router = Router();

// ============================================================================
// Custom Rules (Original)
// ============================================================================

const createRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ruleType: z.enum(['keyword', 'pattern', 'semantic', 'gpt-classification']),
  pattern: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  riskLevel: z.enum(['Critical', 'Warning', 'Normal']),
  enabled: z.boolean().default(true),
});

/**
 * Create a new custom rule
 */
router.post('/', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const validated = createRuleSchema.parse(req.body);
    const authReq = req as WorkspaceRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!authReq.workspace?.tenantId) {
      return res.status(500).json({ error: 'Workspace context missing' });
    }

    const created = await insertCustomRule({
      userId,
      tenantId: authReq.workspace.tenantId,
      name: validated.name,
      description: validated.description,
      ruleType: validated.ruleType,
      pattern: validated.pattern ?? null,
      keywords: validated.keywords ?? null,
      prompt: validated.prompt ?? null,
      riskLevel: validated.riskLevel,
      enabled: validated.enabled,
    });

    res.json({ success: true, ruleId: created?.id ?? null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Create rule error:', error);
    res.status(500).json({
      error: 'Failed to create rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all rules
 */
router.get('/', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const rules = await listCustomRules({ userId: authReq.user.id, tenantId: authReq.workspace.tenantId });

    res.json({
      success: true,
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        ruleType: r.rule_type,
        pattern: r.pattern,
        keywords: r.keywords,
        prompt: r.prompt,
        riskLevel: r.risk_level,
        enabled: r.enabled,
        createdBy: r.user_id,
        createdAt: r.created_at,
      })),
      count: rules.length,
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({
      error: 'Failed to get rules',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get a specific rule
 */
/**
 * Update a rule
 */
router.put('/:ruleId', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const updates = createRuleSchema.partial().parse(req.body);
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const updated = await updateCustomRule({
      userId: authReq.user.id,
      tenantId: authReq.workspace.tenantId,
      ruleId: req.params.ruleId,
      patch: {
        name: updates.name,
        description: updates.description,
        ruleType: updates.ruleType,
        pattern: updates.pattern ?? null,
        keywords: updates.keywords ?? null,
        prompt: updates.prompt ?? null,
        riskLevel: updates.riskLevel,
        enabled: typeof updates.enabled === 'boolean' ? updates.enabled : undefined,
      },
    });

    if (!updated) return res.status(404).json({ error: 'Rule not found' });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Update rule error:', error);
    res.status(500).json({
      error: 'Failed to update rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Delete a rule
 */
router.delete('/:ruleId', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const deleted = await deleteCustomRule({ userId: authReq.user.id, tenantId: authReq.workspace.tenantId, ruleId: req.params.ruleId });
    if (!deleted) return res.status(404).json({ error: 'Rule not found' });

    res.json({
      success: true,
      message: 'Rule deleted',
    });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({
      error: 'Failed to delete rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Test/evaluate rules against document text
 */
router.post('/evaluate', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const { text, ruleIds } = z.object({
      text: z.string().min(1),
      ruleIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const allRules = await listCustomRules({ userId: authReq.user.id, tenantId: authReq.workspace.tenantId });
    const rulesToEvaluate = ruleIds
      ? allRules.filter((r) => ruleIds.includes(r.id))
      : allRules.filter((r) => r.enabled);

    const engineRules: CustomRule[] = rulesToEvaluate.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ruleType: r.rule_type as any,
      pattern: r.pattern ?? undefined,
      keywords: r.keywords ?? undefined,
      prompt: r.prompt ?? undefined,
      riskLevel: r.risk_level as any,
      enabled: r.enabled,
      createdBy: r.user_id,
      createdAt: r.created_at,
    }));

    const matches = await evaluateRules(text, engineRules);

    res.json({
      success: true,
      matches,
      count: matches.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Evaluate rules error:', error);
    res.status(500).json({
      error: 'Failed to evaluate rules',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * India SME Lending: Run consistency check rules (GST vs ITR, employment, address, bank velocity)
 */
router.post('/consistency', async (req: Request, res: Response) => {
  try {
    const { runAllConsistencyRules } = await import('../rules/indiaConsistencyRules.js');
    const body = z.object({
      gstReturns: z.array(z.object({
        type: z.enum(['GSTR-1', 'GSTR-3B']),
        period: z.string(),
        taxableValue: z.number().optional(),
        taxAmount: z.number().optional(),
        fetchedAt: z.string().optional(),
      })).optional().default([]),
      itrForms: z.array(z.object({
        type: z.enum(['ITR-V', 'Form 16']),
        assessmentYear: z.string(),
        grossReceipts: z.number().optional(),
        fetchedAt: z.string().optional(),
      })).optional().default([]),
      bankStatements: z.array(z.object({
        accountId: z.string(),
        fromDate: z.string(),
        toDate: z.string(),
        transactions: z.array(z.object({
          date: z.string(),
          description: z.string(),
          amount: z.number(),
          type: z.enum(['credit', 'debit']),
        })),
        fetchedAt: z.string().optional(),
      })).optional().default([]),
      aadhaarXml: z.object({
        maskedUid: z.string(),
        addressLine1: z.string().optional(),
        state: z.string().optional(),
        pincode: z.string().optional(),
        fetchedAt: z.string().optional(),
      }).optional(),
    }).parse(req.body);
    const result = runAllConsistencyRules({
      gstReturns: body.gstReturns,
      itrForms: body.itrForms,
      bankStatements: body.bankStatements,
      aadhaarXml: body.aadhaarXml,
    });
    res.json({
      success: true,
      consistencyScore: result.consistencyScore,
      riskFlags: result.riskFlags,
      count: result.riskFlags.length,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Consistency rules error:', e);
    res.status(500).json({
      error: 'Failed to run consistency rules',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Dynamic Rules V2 (Rule Engine V2)
// ============================================================================

const ruleTypeSchema = z.enum(['threshold', 'required', 'consistency', 'time']);
const severitySchemaV2 = z.enum(['low', 'medium', 'high', 'critical']);

const thresholdConfigSchema = z.object({
  field: z.string(),
  operator: z.enum(['>', '<', '>=', '<=', '=', '!=']),
  value: z.number(),
  unit: z.string().optional(),
  document_types: z.array(z.string().min(1)).optional(),
  rule_metadata: z.record(z.unknown()).optional(),
});

const requiredConfigSchema = z.object({
  field: z.string(),
  allow_empty: z.boolean().optional(),
  document_types: z.array(z.string().min(1)).optional(),
  rule_metadata: z.record(z.unknown()).optional(),
});

const consistencyConfigSchema = z.object({
  fields: z.array(z.string()).min(2),
  tolerance: z.number(),
  comparison_type: z.enum(['exact', 'percentage', 'absolute']).optional(),
  document_types: z.array(z.string().min(1)).optional(),
  rule_metadata: z.record(z.unknown()).optional(),
});

const timeConfigSchema = z.object({
  max_gap_days: z.number().int().positive(),
  field: z.string().optional(),
  reference_date: z.enum(['today', 'document_date', 'upload_date']).optional(),
  document_types: z.array(z.string().min(1)).optional(),
  rule_metadata: z.record(z.unknown()).optional(),
});

const createDynamicRuleSchema = z.object({
  name: z.string().min(1).max(100),
  rule_type: ruleTypeSchema,
  config: z.union([thresholdConfigSchema, requiredConfigSchema, consistencyConfigSchema, timeConfigSchema]),
  severity: severitySchemaV2.default('medium'),
  weight: z.number().positive().default(1.0),
});

const updateDynamicRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.union([thresholdConfigSchema, requiredConfigSchema, consistencyConfigSchema, timeConfigSchema]).optional(),
  severity: severitySchemaV2.optional(),
  weight: z.number().positive().optional(),
  is_active: z.boolean().optional(),
});

/**
 * List all dynamic rules for tenant (V2)
 * GET /api/rules/v2
 */
router.get('/v2', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    await ensureDefaultRules(authReq.workspace.tenantId);
    const rules = await getDynamicRulesByTenant(authReq.workspace.tenantId);

    res.json({
      success: true,
      rules: rules.map(r => ({
        id: r.id,
        name: r.name,
        rule_type: r.rule_type,
        config: r.config,
        severity: r.severity,
        weight: r.weight,
        is_active: r.is_active,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('List dynamic rules error:', error);
    res.status(500).json({
      error: 'Failed to list dynamic rules',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get a single dynamic rule by ID (V2)
 * GET /api/rules/v2/:ruleId
 */
router.get('/v2/:ruleId', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  try {
    const authReq = req as WorkspaceRequest;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const rule = await getDynamicRuleById(authReq.workspace.tenantId, req.params.ruleId);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({
      success: true,
      rule: {
        id: rule.id,
        name: rule.name,
        rule_type: rule.rule_type,
        config: rule.config,
        severity: rule.severity,
        weight: rule.weight,
        is_active: rule.is_active,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      },
    });
  } catch (error) {
    console.error('Get dynamic rule error:', error);
    res.status(500).json({
      error: 'Failed to get dynamic rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create a new dynamic rule (V2)
 * POST /api/rules/v2
 */
router.post(
  '/v2',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as WorkspaceRequest;
      if (!authReq.user?.id || !authReq.workspace?.tenantId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }

      const validated = createDynamicRuleSchema.parse(req.body);

      const rule = await createDynamicRule({
        tenant_id: authReq.workspace.tenantId,
        name: validated.name,
        rule_type: validated.rule_type as RuleType,
        config: validated.config,
        severity: validated.severity,
        weight: validated.weight,
      });

      if (!rule) {
        return res.status(409).json({
          error: 'Rule creation failed',
          message: 'A rule with this name may already exist',
        });
      }

      res.status(201).json({
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          rule_type: rule.rule_type,
          config: rule.config,
          severity: rule.severity,
          weight: rule.weight,
          is_active: rule.is_active,
          created_at: rule.created_at,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request',
          details: error.errors,
        });
      }
      console.error('Create dynamic rule error:', error);
      res.status(500).json({
        error: 'Failed to create dynamic rule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Update a dynamic rule (V2)
 * PUT /api/rules/v2/:ruleId
 */
router.put(
  '/v2/:ruleId',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as WorkspaceRequest;
      if (!authReq.user?.id || !authReq.workspace?.tenantId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }

      const validated = updateDynamicRuleSchema.parse(req.body);

      const rule = await updateDynamicRule(
        authReq.workspace.tenantId,
        req.params.ruleId,
        validated
      );

      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({
        success: true,
        rule: {
          id: rule.id,
          name: rule.name,
          rule_type: rule.rule_type,
          config: rule.config,
          severity: rule.severity,
          weight: rule.weight,
          is_active: rule.is_active,
          updated_at: rule.updated_at,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request',
          details: error.errors,
        });
      }
      console.error('Update dynamic rule error:', error);
      res.status(500).json({
        error: 'Failed to update dynamic rule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Delete a dynamic rule (V2)
 * DELETE /api/rules/v2/:ruleId
 */
router.delete(
  '/v2/:ruleId',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as WorkspaceRequest;
      if (!authReq.user?.id || !authReq.workspace?.tenantId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }

      const deleted = await deleteDynamicRule(authReq.workspace.tenantId, req.params.ruleId);

      if (!deleted) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
      console.error('Delete dynamic rule error:', error);
      res.status(500).json({
        error: 'Failed to delete dynamic rule',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Sync tenant defaults to latest safe baseline (V2)
 * POST /api/rules/v2/sync-defaults
 */
router.post(
  '/v2/sync-defaults',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as WorkspaceRequest;
      if (!authReq.user?.id || !authReq.workspace?.tenantId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }

      const sync = await syncDefaultRules(authReq.workspace.tenantId);
      const rules = await getDynamicRulesByTenant(authReq.workspace.tenantId);

      res.json({
        success: true,
        sync,
        count: rules.length,
      });
    } catch (error) {
      console.error('Sync default rules error:', error);
      res.status(500).json({
        error: 'Failed to sync default rules',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Default rules changelog for governance (V2)
 * GET /api/rules/v2/default-changelog
 */
router.get(
  '/v2/default-changelog',
  requireAuth,
  requireWorkspaceContext,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as WorkspaceRequest;
      if (!authReq.user?.id || !authReq.workspace?.tenantId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      }

      res.json({
        success: true,
        ruleset: getDefaultRuleChangelog(),
      });
    } catch (error) {
      console.error('Default changelog error:', error);
      res.status(500).json({
        error: 'Failed to fetch default changelog',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
