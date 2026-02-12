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
import {
  saveRule,
  getRule,
  getUserRules,
  updateRule,
  deleteRule,
  getAllRules,
} from '../rules/rulesStorage.js';

const router = Router();

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
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = createRuleSchema.parse(req.body);
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    const rule = createRule({
      ...validated,
      createdBy: userId,
    });

    await saveRule(rule);

    res.json({
      success: true,
      rule,
    });
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const rules = userId ? await getUserRules(userId) : await getAllRules();

    res.json({
      success: true,
      rules,
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
router.get('/:ruleId', async (req: Request, res: Response) => {
  try {
    const rule = await getRule(req.params.ruleId);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({
      error: 'Failed to get rule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Update a rule
 */
router.put('/:ruleId', async (req: Request, res: Response) => {
  try {
    const updates = createRuleSchema.partial().parse(req.body);
    const rule = await updateRule(req.params.ruleId, updates);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({
      success: true,
      rule,
    });
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
router.delete('/:ruleId', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteRule(req.params.ruleId);
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }

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
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { text, ruleIds } = z.object({
      text: z.string().min(1),
      ruleIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const allRules = await getAllRules();
    const rulesToEvaluate = ruleIds
      ? allRules.filter(r => ruleIds.includes(r.id))
      : allRules.filter(r => r.enabled);

    const matches = await evaluateRules(text, rulesToEvaluate);

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

export default router;
