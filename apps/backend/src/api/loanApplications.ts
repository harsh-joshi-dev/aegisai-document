/**
 * Loan Applications API - India SME Lending
 * Create/read loan applications with ULI documents, consistency score, risk flags, DPDP audit
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { pool } from '../db/pgvector.js';

const router = Router();

const createSchema = z.object({
  uliConsentId: z.string().min(1),
  dataPrincipalId: z.string().min(1),
  documents: z.record(z.unknown()).default({}),
  consistencyScore: z.number().int().min(0).max(100).optional(),
  riskFlags: z.array(z.object({
    code: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    message: z.string(),
  })).optional().default([]),
  retentionDays: z.number().int().min(1).max(365).optional().default(90),
  auditTrail: z.array(z.record(z.unknown())).optional().default([]),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = createSchema.parse(req.body);
    const deletionDueDate = new Date();
    deletionDueDate.setDate(deletionDueDate.getDate() + (body.retentionDays ?? 90));
    const client = await pool.connect();
    try {
      const r = await client.query(
        `INSERT INTO loan_applications
         (user_id, uli_consent_id, data_principal_id, documents, consistency_score, risk_flags, deletion_due_date, audit_trail)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, uli_consent_id, data_principal_id, consistency_score, risk_flags, deletion_due_date, created_at`,
        [
          authReq.user!.id,
          body.uliConsentId,
          body.dataPrincipalId,
          JSON.stringify(body.documents),
          body.consistencyScore ?? null,
          JSON.stringify(body.riskFlags),
          deletionDueDate,
          JSON.stringify(body.auditTrail),
        ]
      );
      const row = r.rows[0] as Record<string, unknown>;
      res.status(201).json({
        success: true,
        loanApplication: {
          id: row.id,
          uliConsentId: row.uli_consent_id,
          dataPrincipalId: row.data_principal_id,
          consistencyScore: row.consistency_score,
          riskFlags: row.risk_flags,
          deletionDueDate: row.deletion_due_date,
          createdAt: row.created_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Loan application create error:', e);
    res.status(500).json({
      error: 'Failed to create loan application',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const client = await pool.connect();
    try {
      const r = await client.query(
        `SELECT id, uli_consent_id, data_principal_id, consistency_score, risk_flags, deletion_due_date, created_at
         FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC`,
        [authReq.user!.id]
      );
      res.json({
        success: true,
        loanApplications: r.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          uliConsentId: row.uli_consent_id,
          dataPrincipalId: row.data_principal_id,
          consistencyScore: row.consistency_score,
          riskFlags: row.risk_flags,
          deletionDueDate: row.deletion_due_date,
          createdAt: row.created_at,
        })),
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Loan applications list error:', e);
    res.status(500).json({
      error: 'Failed to list loan applications',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const client = await pool.connect();
    try {
      const r = await client.query(
        `SELECT id, uli_consent_id, data_principal_id, documents, consistency_score, risk_flags, deletion_due_date, audit_trail, created_at
         FROM loan_applications WHERE id = $1 AND user_id = $2`,
        [req.params.id, authReq.user!.id]
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'Loan application not found' });
      }
      const row = r.rows[0] as Record<string, unknown>;
      res.json({
        success: true,
        loanApplication: {
          id: row.id,
          uliConsentId: row.uli_consent_id,
          dataPrincipalId: row.data_principal_id,
          documents: row.documents,
          consistencyScore: row.consistency_score,
          riskFlags: row.risk_flags,
          deletionDueDate: row.deletion_due_date,
          auditTrail: row.audit_trail,
          createdAt: row.created_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Loan application get error:', e);
    res.status(500).json({
      error: 'Failed to get loan application',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
