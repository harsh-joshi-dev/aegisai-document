import express, { Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, updateDocumentFilename, pool } from '../db/pgvector.js';
import { logAuditEvent } from '../compliance/auditLog.js';
import { z } from 'zod';

const router = express.Router();

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
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        uploadedAt: doc.uploaded_at,
        riskLevel: doc.risk_level,
        riskCategory: doc.risk_category || null,
        riskConfidence: doc.risk_confidence || null,
        versionNumber: doc.version_number || 1,
        folderId: doc.folder_id || null,
        metadata: doc.metadata || {},
      })),
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
        oldFilename: oldDoc.rows[0].filename,
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
        id: updated.id,
        filename: updated.filename,
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
