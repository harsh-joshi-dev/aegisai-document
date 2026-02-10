import express, { Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, updateDocumentFilename, pool, getDocumentContent } from '../db/pgvector.js';
import { logAuditEvent } from '../compliance/auditLog.js';
import { z } from 'zod';

const router = express.Router();

/**
 * Get document content (from chunks) for authenticated owner.
 * GET /api/documents/:documentId/content
 */
router.get('/:documentId/content', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { documentId } = req.params;
  if (!authReq.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  try {
    const docs = await getDocuments({ userId: authReq.user.id, documentIds: [documentId] });
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
 * Public shared document view — no auth required.
 * GET /api/documents/:documentId/shared
 * Returns document summary for shared link (id, filename, risk, etc.).
 */
router.get('/:documentId/shared', async (req: Request, res: Response) => {
  const { documentId } = req.params;
  if (!documentId) {
    return res.status(400).json({ error: 'Document ID is required' });
  }
  try {
    const row = await pool.query(
      `SELECT id, filename, uploaded_at, risk_level, risk_category, risk_confidence, metadata
       FROM documents WHERE id = $1`,
      [documentId]
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
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  
  try {
    const validated = listDocumentsSchema.parse(req.query);
    
    const documents = await getDocuments({
      ...validated,
      userId,
    });
    
    res.json({
      success: true,
      documents: documents.map((doc: { id: string; filename: string; uploaded_at: Date; risk_level: string; risk_category: string | null; risk_confidence: number | null; version_number: number; folder_id: string | null; metadata: Record<string, unknown> }) => {
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
router.put('/:documentId/rename', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
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
    // Get old filename for audit log
    const oldDoc = await pool.query(
      `SELECT filename FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (oldDoc.rows.length === 0) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist or you do not have permission to rename it',
      });
    }

    const updated = await updateDocumentFilename(documentId, userId, filename.trim());

    if (!updated) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist or you do not have permission to rename it',
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
      },
      req.ip,
      req.get('user-agent') || '',
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      message: 'Document renamed successfully',
      document: {
        id: (updated as { id: string; filename: string }).id,
        filename: (updated as { id: string; filename: string }).filename,
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

export default router;
