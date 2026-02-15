import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDocumentContent, pool } from '../db/pgvector.js';
import { verifyDocument } from '../services/documentVerification.js';
import { logAuditEvent } from '../compliance/auditLog.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

router.post('/:documentId', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const tenantId = authReq.workspace.tenantId;
  const userId = authReq.user.id;
  const { documentId } = req.params;

  try {
    // Get document with full details
    const client = await pool.connect();
    let document: any;
    try {
      const result = await client.query(
        `SELECT id, filename, uploaded_at, risk_level, metadata, tenant_id, file_data 
         FROM documents WHERE id = $1 AND tenant_id = $2`,
        [documentId, tenantId]
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

    // Log audit event with tenant context
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
        tenantId,
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
