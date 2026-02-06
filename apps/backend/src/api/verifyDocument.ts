import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocumentContent, pool } from '../db/pgvector.js';
import { verifyDocument } from '../services/documentVerification.js';
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

  try {
    // Get document with full details
    const client = await pool.connect();
    let document: any;
    try {
      const result = await client.query(
        `SELECT id, filename, uploaded_at, risk_level, metadata, user_id, file_data 
         FROM documents WHERE id = $1`,
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
        message: 'Cannot verify document without content',
      });
    }

    // Get file buffer if available
    let fileBuffer: Buffer | undefined;
    if (document.file_data) {
      fileBuffer = Buffer.from(document.file_data);
    }

    // Perform verification
    const verificationResult = await verifyDocument(
      documentContent,
      fileBuffer || Buffer.from(''),
      document.filename,
      document.metadata
    );

    // Log audit event
    await logAuditEvent(
      userId,
      'document_verification',
      'document',
      documentId,
      {
        filename: document.filename,
        status: verificationResult.status,
        fraudScore: verificationResult.fraudScore,
        confidence: verificationResult.confidence,
      },
      req.ip,
      req.get('user-agent'),
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      verification: verificationResult,
      document: {
        id: document.id,
        filename: document.filename,
      },
    });
  } catch (error) {
    console.error('Document verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
