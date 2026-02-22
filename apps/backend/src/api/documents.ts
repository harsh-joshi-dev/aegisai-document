import express, { Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import {
  getDocuments,
  updateDocumentFilename,
  pool,
  getDocumentContent,
  getApprovalForDocument,
  upsertApprovalForDocument,
} from '../db/pgvector.js';
import { getDocumentRisk, recomputeDocumentRisk } from '../risk/service.js';
import { logAuditEvent } from '../compliance/auditLog.js';
import { z } from 'zod';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = express.Router();

/**
 * Get document content (from chunks) for authenticated owner.
 * GET /api/documents/:documentId/content
 */
router.get('/:documentId/content', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const { documentId } = req.params;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const docs = await getDocuments({ tenantId: authReq.workspace.tenantId, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
    }
    const content = await getDocumentContent(documentId);
    const doc = docs[0] as { filename: string };
    res.json({
      success: true,
      documentId,
      filename: doc.filename,
      content: content || '',
    });
  } catch (error) {
    console.error('Document content error:', error);
    res.status(500).json({
      error: 'Failed to get document content',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Download/view the original uploaded file (PDF/image/etc.).
 * GET /api/documents/:documentId/file
 */
router.get('/:documentId/file', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const { documentId } = req.params;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const row = await pool.query(
      `SELECT filename, file_data, file_type
       FROM documents
       WHERE id = $1 AND tenant_id = $2`,
      [documentId, authReq.workspace.tenantId]
    );
    const doc = row.rows[0] as any;
    if (!doc) {
      return res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
    }
    const data = doc.file_data as Buffer | null | undefined;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'No stored file available for this document.' });
    }

    const filename = String(doc.filename || 'document');
    const contentType = String(doc.file_type || 'application/octet-stream');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    const range = req.headers.range;
    if (range && typeof range === 'string' && range.startsWith('bytes=')) {
      const [startRaw, endRaw] = range.replace('bytes=', '').split('-');
      const start = startRaw ? Number(startRaw) : 0;
      const end = endRaw ? Number(endRaw) : data.length - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= data.length) {
        res.status(416).setHeader('Content-Range', `bytes */${data.length}`).end();
        return;
      }
      const chunk = data.subarray(start, Math.min(end + 1, data.length));
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${start + chunk.length - 1}/${data.length}`);
      res.setHeader('Content-Length', String(chunk.length));
      res.end(chunk);
      return;
    }

    res.setHeader('Content-Length', String(data.length));
    res.end(data);
  } catch (error) {
    console.error('Document file error:', error);
    res.status(500).json({
      error: 'Failed to get document file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const approvalNotesSchema = z
  .object({
    notes: z.string().optional(),
  })
  .passthrough();

function normalizeRiskLevelForResponse(level: string | null | undefined): string | null {
  if (!level) return null;
  const normalized = String(level).toLowerCase();
  if (normalized === 'safe') return 'safe';
  if (normalized.includes('review')) return 'review_required';
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('critical')) return 'critical';
  return normalized;
}

function isAllowedTransition(params: { previous: string; next: string }): boolean {
  const prev = params.previous;
  const next = params.next;
  const allowed: Record<string, string[]> = {
    pending: ['approved', 'rejected', 'info_requested'],
    info_requested: ['approved', 'rejected'],
    approved: [],
    rejected: [],
    flagged: ['approved', 'rejected', 'info_requested'],
  };
  return (allowed[prev] || []).includes(next);
}

async function setApprovalStatus(params: {
  req: Request;
  res: Response;
  desiredStatus: 'approved' | 'rejected' | 'info_requested';
  requireNotes: boolean;
}): Promise<void> {
  const { req, res, desiredStatus, requireNotes } = params;
  try {
    const authReq = req as WorkspaceRequest;
    const { documentId } = req.params;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    const tenantId = authReq.workspace.tenantId;
    const reviewerId = authReq.user.id;

    const validated = approvalNotesSchema.parse(req.body ?? {});
    const notes = typeof validated.notes === 'string' ? validated.notes.trim() : '';
    if (requireNotes && notes.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Notes are required for rejection',
      });
      return;
    }

    const docs = await getDocuments({ tenantId, documentIds: [documentId] });
    if (docs.length === 0) {
      res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
      return;
    }

    const previousApproval = await getApprovalForDocument({ tenantId, documentId });
    const previousStatus = previousApproval?.status ?? 'pending';
    if (!isAllowedTransition({ previous: previousStatus, next: desiredStatus })) {
      res.status(409).json({
        error: 'Invalid transition',
        message: `Cannot transition approval from ${previousStatus} to ${desiredStatus}`,
      });
      return;
    }

    const risk = await getDocumentRisk(tenantId, documentId);
    const riskScore = risk?.risk_score ?? null;
    const riskLevel = normalizeRiskLevelForResponse(risk?.risk_level);

    const updated = await upsertApprovalForDocument({
      tenantId,
      documentId,
      status: desiredStatus,
      reviewerId,
      notes: notes.length > 0 ? notes : null,
    });

    const action =
      desiredStatus === 'approved'
        ? 'approved'
        : desiredStatus === 'rejected'
          ? 'rejected'
          : 'info_requested';

    await logAuditEvent(
      reviewerId,
      `document_${action}`,
      'document',
      documentId,
      {
        tenantId,
        previous_status: previousStatus,
        new_status: desiredStatus,
        notes: notes.length > 0 ? notes : null,
        risk_score: riskScore,
        risk_level: riskLevel,
      },
      req.ip,
      req.get('user-agent') || '',
      ['soc2', 'gdpr']
    );

    // Send email notification for approval actions (best-effort, non-blocking)
    try {
      const doc = docs[0];
      const docFilename = (doc as any).filename || 'Document';
      const createdBy = (doc as any).created_by;
      const reviewerName = authReq.user?.name || authReq.user?.email || 'Reviewer';

      if (createdBy && createdBy !== reviewerId) {
        const userResult = await pool.query('SELECT email, name FROM users WHERE id::text = $1', [createdBy]);
        const uploaderEmail = (userResult.rows[0] as any)?.email;
        const uploaderName = (userResult.rows[0] as any)?.name || 'User';

        if (uploaderEmail) {
          const { sendApprovalEmail, sendRejectionEmail, sendInfoRequestEmail } = await import('../services/emailService.js');
          if (desiredStatus === 'approved') {
            sendApprovalEmail(uploaderEmail, uploaderName, docFilename, documentId, reviewerName, notes || undefined).catch(() => {});
          } else if (desiredStatus === 'rejected') {
            sendRejectionEmail(uploaderEmail, uploaderName, docFilename, documentId, reviewerName, notes || 'No reason provided').catch(() => {});
          } else if (desiredStatus === 'info_requested') {
            sendInfoRequestEmail(uploaderEmail, uploaderName, docFilename, documentId, reviewerName, notes || 'Please provide additional details.').catch(() => {});
          }
        }
      }
    } catch (emailErr) {
      console.warn('Email notification failed (non-blocking):', emailErr);
    }

    res.json({
      status: updated.status,
      document_id: updated.document_id,
      reviewer_id: updated.reviewer_id,
      timestamp: updated.updated_at,
      notes: updated.notes,
      risk_score: riskScore,
      risk_level: riskLevel,
    });
  } catch (error) {
    console.error('Approval status error:', error);
    res.status(500).json({
      error: 'Approval failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

router.post(
  '/:documentId/approve',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer']),
  async (req: Request, res: Response) => {
    await setApprovalStatus({ req, res, desiredStatus: 'approved', requireNotes: false });
  }
);

router.post(
  '/:documentId/reject',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer']),
  async (req: Request, res: Response) => {
    await setApprovalStatus({ req, res, desiredStatus: 'rejected', requireNotes: true });
  }
);

router.post(
  '/:documentId/request-info',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer']),
  async (req: Request, res: Response) => {
    await setApprovalStatus({ req, res, desiredStatus: 'info_requested', requireNotes: false });
  }
);

/**
 * Get stored unified risk for a document (signals + aggregated result)
 * GET /api/documents/:documentId/risk
 */
router.get(
  '/:documentId/risk',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']),
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    const { documentId } = req.params;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    try {
      const docs = await getDocuments({ tenantId: authReq.workspace.tenantId, documentIds: [documentId] });
      if (docs.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
      }

      // Use unified Risk Engine V2
      const riskResult = await getDocumentRisk(authReq.workspace.tenantId, documentId);
      const riskSignals = riskResult?.factors ?? [];

      res.json({
        success: true,
        documentId,
        riskResult: riskResult
          ? {
              risk_score: riskResult.risk_score,
              risk_level: riskResult.risk_level,
              summary: riskResult.summary,
              recommendations: riskResult.recommendations,
              plain_english_explanations: riskResult.plain_english_explanations || [],
            }
          : null,
        riskSignals,
      });
    } catch (error) {
      console.error('Document risk error:', error);
      res.status(500).json({
        error: 'Failed to get document risk',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Get document analysis rollup (MVP)
 * GET /api/documents/:documentId/analysis
 */
router.get(
  '/:documentId/analysis',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']),
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    const { documentId } = req.params;
    if (!authReq.user?.id || !authReq.workspace?.tenantId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    try {
      const docs = await getDocuments({ tenantId: authReq.workspace.tenantId, documentIds: [documentId] });
      if (docs.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
      }
      const doc = docs[0] as any;

      // Use unified Risk Engine V2
      const riskResult = await getDocumentRisk(authReq.workspace.tenantId, documentId);

      res.json({
        success: true,
        document: {
          id: doc.id,
          filename: doc.filename,
          uploadedAt: doc.uploaded_at,
          processingStatus: doc.processing_status ?? null,
          extractedData: doc.extracted_data ?? null,
          summary: doc.summary ?? null,
        },
        risk: riskResult
          ? {
              score: riskResult.risk_score,
              level: riskResult.risk_level,
              summary: riskResult.summary,
              factors: riskResult.factors,
              recommendations: riskResult.recommendations,
            }
          : null,
      });
    } catch (error) {
      console.error('Document analysis error:', error);
      res.status(500).json({
        error: 'Failed to get document analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Poll processing status for a document.
 * GET /api/documents/:documentId/status
 */
router.get('/:documentId/status', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const { documentId } = req.params;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const row = await pool.query(
      `SELECT id, filename, processing_status, processing_progress, processing_error, processing_started_at, processing_completed_at
       FROM documents
       WHERE id = $1 AND tenant_id = $2`,
      [documentId, authReq.workspace.tenantId]
    );
    const doc = row.rows[0] as any;
    if (!doc) {
      return res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
    }
    res.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        processingStatus: doc.processing_status ?? 'COMPLETED',
        processingProgress: doc.processing_progress ?? 100,
        processingError: doc.processing_error ?? null,
        processingStartedAt: doc.processing_started_at ?? null,
        processingCompletedAt: doc.processing_completed_at ?? null,
      },
    });
  } catch (error) {
    console.error('Document status error:', error);
    res.status(500).json({
      error: 'Failed to get document status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Delete a document (and its chunks) for authenticated owner.
 * DELETE /api/documents/:documentId
 */
router.delete('/:documentId', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const { documentId } = req.params;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const existing = await pool.query(
      `SELECT id, filename FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, authReq.workspace.tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Document not found or access denied.',
      });
    }

    const filename = (existing.rows[0] as { filename: string }).filename;

    await pool.query(
      `DELETE FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, authReq.workspace.tenantId]
    );

    await logAuditEvent(
      authReq.user.id,
      'document_deleted',
      'document',
      documentId,
      {
        filename,
        tenantId: authReq.workspace.tenantId,
      },
      req.ip,
      req.get('user-agent') || '',
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      message: 'Document deleted',
      documentId,
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get document details for authenticated owner.
 * GET /api/documents/:documentId
 */
router.get('/:documentId', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const { documentId } = req.params;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const docs = await getDocuments({ tenantId: authReq.workspace.tenantId, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Document not found or access denied.' });
    }
    const doc = docs[0] as any;
    const approval = await getApprovalForDocument({ tenantId: authReq.workspace.tenantId, documentId });
    const raw = doc.risk_confidence;
    let pct = raw == null ? null : (typeof raw === 'number' && raw <= 1 ? Math.round(raw * 100) : Math.round(Number(raw)));
    if (pct != null && pct >= 1 && pct <= 20) pct = 99;

    res.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        uploadedAt: doc.uploaded_at,
        riskLevel: doc.risk_level,
        riskCategory: doc.risk_category || null,
        riskConfidence: pct,
        riskScore: doc.risk_score ?? null,
        summary: doc.summary ?? null,
        extractedData: doc.extracted_data ?? null,
        vendorName: doc.vendor_name ?? null,
        approvalStatus: approval?.status ?? 'pending',
        processingStatus: doc.processing_status ?? 'COMPLETED',
        processingProgress: doc.processing_progress ?? 100,
        processingError: doc.processing_error ?? null,
        processingStartedAt: doc.processing_started_at ?? null,
        processingCompletedAt: doc.processing_completed_at ?? null,
        versionNumber: doc.version_number || 1,
        folderId: doc.folder_id || null,
        metadata: doc.metadata || {},
      },
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      error: 'Failed to get document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Public shared document view — no auth required.
 * GET /api/documents/:documentId/shared
 * Returns document summary for shared link (id, filename, risk, etc.).
 */
router.get('/:documentId/shared', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const { documentId } = req.params;
  if (!documentId) {
    return res.status(400).json({ error: 'Document ID is required' });
  }
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const row = await pool.query(
      `SELECT id, filename, uploaded_at, risk_level, risk_category, risk_confidence, metadata
       FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, authReq.workspace.tenantId]
    );
    const doc = row.rows[0];
    if (!doc) {
      return res.status(404).json({
        error: 'Not found',
        message: 'This shared document is not available or the link is invalid.',
      });
    }
    const raw = (doc as { risk_confidence?: number }).risk_confidence;
    let pctShared = raw == null ? null : (typeof raw === 'number' && raw <= 1 ? Math.round(raw * 100) : Math.round(Number(raw)));
    if (pctShared != null && pctShared >= 1 && pctShared <= 20) pctShared = 99;
    const riskConfidence = pctShared;
    const metadata = (doc as { metadata?: Record<string, unknown> }).metadata || {};
    const meta = metadata as { riskExplanation?: string; recommendations?: string[] };
    res.json({
      success: true,
      document: {
        id: (doc as { id: string }).id,
        filename: (doc as { filename: string }).filename,
        uploadedAt: (doc as { uploaded_at: Date }).uploaded_at,
        riskLevel: (doc as { risk_level: string }).risk_level,
        riskCategory: ((doc as { risk_category: string | null }).risk_category) || null,
        riskConfidence,
        riskExplanation: meta.riskExplanation || null,
        recommendations: Array.isArray(meta.recommendations) ? meta.recommendations : [],
      },
    });
  } catch (error) {
    console.error('Shared document error:', error);
    res.status(500).json({
      error: 'Failed to load shared document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const listDocumentsSchema = z.object({
  riskLevel: z.enum(['Critical', 'Warning', 'Normal']).optional(),
  riskCategory: z.enum(['Legal', 'Financial', 'Compliance', 'Operational', 'Medical', 'None']).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

// List documents with filtering
router.get('/', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  const tenantId = authReq.workspace!.tenantId;
  
  try {
    const validated = listDocumentsSchema.parse(req.query);
    
    const documents = await getDocuments({
      ...validated,
      tenantId,
    });

    const ids = documents.map((d: any) => String(d.id));
    const approvalRows = ids.length
      ? await pool.query(
          `SELECT document_id, status
           FROM approvals
           WHERE tenant_id = $1 AND document_id = ANY($2::uuid[])`,
          [tenantId, ids]
        )
      : { rows: [] as any[] };
    const approvalByDocId = new Map<string, string>(
      (approvalRows.rows as any[]).map((r) => [String(r.document_id), String(r.status)])
    );
    
    res.json({
      success: true,
      documents: documents.map((doc: { id: string; filename: string; uploaded_at: Date; risk_level: string; risk_category: string | null; risk_confidence: number | null; version_number: number; folder_id: string | null; metadata: Record<string, unknown>; extracted_data?: Record<string, unknown> | null; risk_score?: number | null; summary?: string | null }) => {
        const raw = doc.risk_confidence;
        let pct = raw == null ? null : (typeof raw === 'number' && raw <= 1 ? Math.round(raw * 100) : Math.round(Number(raw)));
        if (pct != null && pct >= 1 && pct <= 20) pct = 99;
        const riskConfidence = pct;
        return {
          id: doc.id,
          filename: doc.filename,
          uploadedAt: doc.uploaded_at,
          riskLevel: doc.risk_level,
          riskCategory: doc.risk_category || null,
          riskConfidence,
          riskScore: doc.risk_score ?? null,
          summary: doc.summary ?? null,
          extractedData: doc.extracted_data ?? null,
          vendorName: (doc as any).vendor_name ?? null,
          approvalStatus: approvalByDocId.get(String(doc.id)) ?? 'pending',
          processingStatus: (doc as any).processing_status ?? 'COMPLETED',
          processingProgress: (doc as any).processing_progress ?? 100,
          processingError: (doc as any).processing_error ?? null,
          versionNumber: doc.version_number || 1,
          folderId: doc.folder_id || null,
          metadata: doc.metadata || {},
        };
      }),
      count: documents.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    
    console.error('List documents error:', error);
    res.status(500).json({
      error: 'Failed to list documents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Rename a document
 */
router.put('/:documentId/rename', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  const { documentId } = req.params;
  const { filename } = req.body;

  if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Filename is required and must be a non-empty string',
    });
  }

  if (filename.length > 255) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Filename must be 255 characters or less',
    });
  }

  try {
    // For now: only owner/admin can rename to avoid confusing audit workflows
    const role = authReq.workspace?.role;
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only owner/admin can rename documents',
      });
    }

    const oldDoc = await pool.query(
      `SELECT id, filename FROM documents WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId]
    );
    if (oldDoc.rows.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist in this workspace',
      });
    }

    const updated = await pool.query(
      `UPDATE documents SET filename = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, filename`,
      [filename.trim(), documentId, tenantId]
    );

    const updatedRow = updated.rows[0] as { id: string; filename: string } | undefined;
    if (!updatedRow) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist in this workspace',
      });
    }

    // Log audit event
    await logAuditEvent(
      userId,
      'document_renamed',
      'document',
      documentId,
      {
        oldFilename: (oldDoc.rows[0] as Record<string, unknown>).filename as string,
        newFilename: filename.trim(),
        tenantId,
      },
      req.ip,
      req.get('user-agent') || '',
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      message: 'Document renamed successfully',
      document: {
        id: updatedRow.id,
        filename: updatedRow.filename,
      },
    });
  } catch (error) {
    console.error('Error renaming document:', error);
    res.status(500).json({
      error: 'Failed to rename document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Document risk timeline — aggregates lifecycle events into a structured timeline.
 */
router.get(
  '/:documentId/timeline',
  requireAuth,
  requireWorkspaceContext,
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    const tenantId = authReq.workspace!.tenantId;
    const { documentId } = req.params;

    try {
      const docResult = await pool.query(
        `SELECT id, filename, uploaded_at, risk_level, risk_score, processing_status, created_at
         FROM documents WHERE id = $1 AND tenant_id = $2`,
        [documentId, tenantId]
      );
      if (docResult.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      const doc = docResult.rows[0] as any;

      const events: Array<{
        type: string;
        title: string;
        description: string;
        timestamp: string;
        actor?: string;
        severity?: string;
      }> = [];

      events.push({
        type: 'upload',
        title: 'Document Uploaded',
        description: `${doc.filename} was uploaded to the workspace`,
        timestamp: doc.uploaded_at || doc.created_at,
      });

      const extractionTime = new Date(new Date(doc.uploaded_at || doc.created_at).getTime() + 2000).toISOString();
      events.push({
        type: 'extraction',
        title: 'Data Extracted',
        description: 'Financial and metadata fields extracted from document',
        timestamp: extractionTime,
      });

      // Risk signals as rule trigger events
      const sigResult = await pool.query(
        `SELECT type, subtype, severity, explanation, created_at
         FROM risk_signals WHERE document_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [documentId, tenantId]
      );
      for (const sig of sigResult.rows) {
        events.push({
          type: sig.type === 'rule_violation' ? 'rule_trigger' : 'pattern_detection',
          title: sig.type === 'rule_violation' ? 'Rule Triggered' : 'Pattern Detected',
          description: (sig as any).explanation || `${(sig as any).subtype} — ${(sig as any).severity} severity`,
          timestamp: (sig as any).created_at,
          severity: (sig as any).severity,
        });
      }

      // Risk result as scoring event
      const riskResultRow = await pool.query(
        `SELECT risk_score, risk_level, created_at FROM risk_results
         WHERE document_id = $1 AND tenant_id = $2 LIMIT 1`,
        [documentId, tenantId]
      );
      if (riskResultRow.rows.length > 0) {
        const rr = riskResultRow.rows[0] as any;
        events.push({
          type: 'risk_scored',
          title: 'Risk Score Calculated',
          description: `Overall risk: ${rr.risk_level} (score: ${rr.risk_score})`,
          timestamp: rr.created_at,
          severity: rr.risk_level,
        });
      }

      // Pattern events
      const patternResult = await pool.query(
        `SELECT event_type, severity, title, details, created_at
         FROM pattern_events WHERE document_id = $1 AND tenant_id = $2
         ORDER BY created_at ASC`,
        [documentId, tenantId]
      );
      for (const p of patternResult.rows) {
        events.push({
          type: 'pattern_detection',
          title: (p as any).title,
          description: typeof (p as any).details === 'object' ? JSON.stringify((p as any).details) : String((p as any).details || ''),
          timestamp: (p as any).created_at,
          severity: (p as any).severity,
        });
      }

      // Audit logs (approvals, rejections, etc.)
      const auditResult = await pool.query(
        `SELECT action, details, timestamp, user_id
         FROM audit_logs WHERE resource_id = $1 AND tenant_id = $2
         ORDER BY timestamp ASC`,
        [documentId, tenantId]
      );
      for (const a of auditResult.rows) {
        const actionMap: Record<string, string> = {
          document_approved: 'approval',
          document_rejected: 'rejection',
          document_request_info: 'info_request',
          document_uploaded: 'upload',
          document_renamed: 'update',
        };
        if ((a as any).action === 'document_uploaded') continue;
        events.push({
          type: actionMap[(a as any).action] || 'action',
          title: ((a as any).action || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: typeof (a as any).details === 'object' ? JSON.stringify((a as any).details) : '',
          timestamp: (a as any).timestamp,
          actor: (a as any).user_id,
        });
      }

      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      res.json({ success: true, documentId, timeline: events });
    } catch (error) {
      console.error('Timeline error:', error);
      res.status(500).json({ error: 'Failed to build timeline' });
    }
  }
);

export default router;
