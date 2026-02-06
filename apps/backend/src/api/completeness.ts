import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocumentContent, pool } from '../db/pgvector.js';
import { analyzeDocumentCompleteness } from '../services/documentCompleteness.js';
import { logAuditEvent } from '../compliance/auditLog.js';

const router = Router();

router.post('/:documentId', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const { documentId } = req.params;
  const { documentType } = req.body;

  try {
    // Get document
    const client = await pool.connect();
    let document: any;
    try {
      const result = await client.query(
        `SELECT id, filename, metadata, user_id FROM documents WHERE id = $1`,
        [documentId]
      );
      document = result.rows[0];
    } finally {
      client.release();
    }

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist',
      });
    }

    // Verify ownership
    if (document.user_id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this document',
      });
    }

    // Get document content
    const documentContent = await getDocumentContent(documentId);
    if (!documentContent) {
      return res.status(400).json({
        error: 'Document content not available',
        message: 'Cannot analyze completeness without content',
      });
    }

    // Perform completeness analysis
    const analysis = await analyzeDocumentCompleteness(
      documentContent,
      document.filename,
      documentType
    );

    // Log audit event
    await logAuditEvent(
      userId,
      'document_completeness_check',
      'document',
      documentId,
      {
        filename: document.filename,
        completenessScore: analysis.completenessScore,
        missingCount: analysis.missingElements.length,
        status: analysis.overallStatus,
      },
      req.ip,
      req.get('user-agent'),
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      analysis,
      document: {
        id: document.id,
        filename: document.filename,
      },
    });
  } catch (error) {
    console.error('Document completeness analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
