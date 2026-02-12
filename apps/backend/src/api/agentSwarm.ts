import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import { executeAgentSwarm } from '../agents/orchestrator.js';
import { runAllConsistencyRules } from '../rules/indiaConsistencyRules.js';
import { generateDueDiligenceReport } from '../agents/dueDiligenceReportAgent.js';

const router = Router();

const agentSwarmRequestSchema = z.object({
  documentId: z.string().uuid(),
  userParty: z.string().optional(), // Which party the user represents
  jurisdictions: z.array(z.string()).optional(), // Specific jurisdictions to check
});

const financialConsistencySchema = z.object({
  gstReturns: z.array(z.object({
    type: z.enum(['GSTR-1', 'GSTR-3B']),
    period: z.string(),
    taxableValue: z.number().optional(),
    taxAmount: z.number().optional(),
  })).optional().default([]),
  itrForms: z.array(z.object({
    type: z.enum(['ITR-V', 'Form 16']),
    assessmentYear: z.string(),
    grossReceipts: z.number().optional(),
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
  })).optional().default([]),
  aadhaarXml: z.object({
    maskedUid: z.string(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const validated = agentSwarmRequestSchema.parse(req.body);

    // Verify user owns this document
    const userDocuments = await getDocuments({
      userId: authReq.user!.id,
      documentIds: [validated.documentId],
    });

    if (userDocuments.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document does not exist or you do not have access to it.',
      });
    }

    const document = userDocuments[0];

    // Execute agent swarm
    console.log(`[API] Starting agent swarm for document ${validated.documentId}`);
    const result = await executeAgentSwarm(
      validated.documentId,
      document.filename,
      validated.userParty,
      validated.jurisdictions
    );

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('Agent swarm error:', error);
    res.status(500).json({
      error: 'Failed to execute agent swarm',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agent-swarm/financial-consistency
 * India SME Lending: Run consistency rules + Due Diligence Report for NBFC credit committees
 */
router.post('/financial-consistency', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = financialConsistencySchema.parse(req.body);
    const { riskFlags, consistencyScore } = runAllConsistencyRules({
      gstReturns: body.gstReturns,
      itrForms: body.itrForms,
      bankStatements: body.bankStatements,
      aadhaarXml: body.aadhaarXml,
    });
    const documentsSummary = [
      `GST returns: ${body.gstReturns.length}`,
      `ITR/Form 16: ${body.itrForms.length}`,
      `Bank statements: ${body.bankStatements.length}`,
      body.aadhaarXml ? 'Aadhaar: verified' : 'Aadhaar: not provided',
    ].join('; ');
    const report = await generateDueDiligenceReport(documentsSummary, consistencyScore, riskFlags);
    res.json({
      success: true,
      consistencyScore,
      riskFlags,
      report,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Financial consistency swarm error:', error);
    res.status(500).json({
      error: 'Failed to run financial consistency analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
