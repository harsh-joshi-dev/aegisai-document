import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { pool, getDocuments, getOrCreateFolderByTenant, setDocumentFolderByTenant } from '../db/pgvector.js';
import { getFinancialYearFromDate } from '../services/documentTypeClassifier.js';
import { logAuditEvent } from '../compliance/auditLog.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';

const router = Router();

// Initialize folders table
export async function initializeFolders() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      );
    `);

    try {
      await client.query(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);`);
    } catch {
      // ignore
    }
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS folders_tenant_id_idx ON folders(tenant_id);`);
    } catch {
      // ignore
    }
    try {
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS folders_tenant_name_uq
         ON folders(tenant_id, name)
         WHERE tenant_id IS NOT NULL AND name IS NOT NULL;`
      );
    } catch {
      // ignore
    }

    // Add folder_id column to documents if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'documents' AND column_name = 'folder_id'
        ) THEN
          ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);
      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
    `);

    console.log('✅ Folders table initialized');
  } catch (error) {
    console.error('Error initializing folders:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Auto year-wise organization: move documents into FY YYYY-YY folders
router.post('/organize-by-year', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  try {
    const docs = await getDocuments({ tenantId });
    let moved = 0;
    for (const doc of docs) {
      const meta = (doc as { metadata?: { financialYear?: string } }).metadata || {};
      const uploadedAt = (doc as { uploaded_at?: Date | string }).uploaded_at;
      const fy = meta.financialYear || getFinancialYearFromDate(new Date(uploadedAt || Date.now()));
      const folderId = await getOrCreateFolderByTenant({ tenantId, actorUserId: userId, folderName: fy });
      if (folderId) {
        await setDocumentFolderByTenant({ documentId: doc.id, tenantId, folderId });
        moved++;
      }
    }
    res.json({ success: true, message: `Organized ${moved} documents by financial year.`, moved, total: docs.length });
  } catch (error) {
    console.error('Organize by year error:', error);
    res.status(500).json({
      error: 'Failed to organize by year',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Auto vendor-wise organization: move documents into vendor folders
router.post('/organize-by-vendor', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;
  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  try {
    const docs = await getDocuments({ tenantId });
    let moved = 0;
    const vendorFolders: Record<string, string> = {};

    for (const doc of docs) {
      let vendorName = 'Uncategorized';
      
      try {
        // Extract vendor name from various possible locations
        const extractedData = (doc as any).extracted_data;
        const metadata = (doc as any).metadata;
        const filename = (doc as any).filename || '';
        const existingVendorName = (doc as any).vendor_name;

        // Use existing vendor_name if available
        if (existingVendorName && existingVendorName.trim()) {
          vendorName = existingVendorName;
        } else {
          // Try multiple sources for vendor name
          if (extractedData) {
            const parsedExtracted = typeof extractedData === 'string' ? JSON.parse(extractedData) : extractedData;
            vendorName = parsedExtracted?.vendorName || 
                        parsedExtracted?.vendor || 
                        parsedExtracted?.supplierName ||
                        parsedExtracted?.supplier ||
                        parsedExtracted?.billedBy ||
                        vendorName;
          }

          // Fallback to metadata
          if (vendorName === 'Uncategorized' && metadata) {
            const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            vendorName = parsedMetadata?.vendorName || 
                        parsedMetadata?.vendor || 
                        parsedMetadata?.supplier ||
                        vendorName;
          }

          // Extract from filename as last resort (e.g., "invoice_acme_corp.pdf" -> "acme_corp")
          if (vendorName === 'Uncategorized') {
            const nameParts: string[] = String(filename).toLowerCase().split(/[\s_-]+/);
            if (nameParts.length > 1) {
              // Take the first meaningful part after document type
              const docTypes = ['invoice', 'receipt', 'bill', 'po', 'purchase', 'order', 'statement', 'document', 'pdf', 'doc'];
              const meaningfulPart = nameParts.find((part: string) => part && !docTypes.includes(part));
              if (meaningfulPart) {
                vendorName = meaningfulPart.charAt(0).toUpperCase() + meaningfulPart.slice(1);
              }
            }
          }
        }
      } catch (e) {
        // If parsing fails, use uncategorized
        console.error(`Error extracting vendor for doc ${doc.id}:`, e);
      }
      
      // Sanitize vendor name for folder name (remove special chars, limit length)
      vendorName = String(vendorName)
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .trim()
        .substring(0, 100)
        .replace(/\s+/g, ' ');
      
      if (!vendorName) vendorName = 'Uncategorized';

      // Update vendor_name in document if different
      try {
        await pool.query(
          `UPDATE documents SET vendor_name = $1 WHERE id = $2 AND tenant_id = $3`,
          [vendorName, doc.id, tenantId]
        );
      } catch (e) {
        console.error(`Error updating vendor_name for doc ${doc.id}:`, e);
      }

      // Get or create folder for this vendor
      if (!vendorFolders[vendorName]) {
        const folderId = await getOrCreateFolderByTenant({ tenantId, actorUserId: userId, folderName: vendorName });
        if (folderId) {
          vendorFolders[vendorName] = folderId;
        } else {
          continue; // Skip if folder couldn't be created
        }
      }

      const folderId = vendorFolders[vendorName];
      if (folderId) {
        await setDocumentFolderByTenant({ documentId: doc.id, tenantId, folderId });
        moved++;
      }
    }

    const uniqueVendors = Object.keys(vendorFolders).length;
    res.json({
      success: true,
      message: `Organized ${moved} documents into ${uniqueVendors} vendor folders.`,
      moved,
      total: docs.length,
      vendors: uniqueVendors,
    });
  } catch (error) {
    console.error('Organize by vendor error:', error);
    res.status(500).json({
      error: 'Failed to organize by vendor',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get all folders for user
router.get('/', requireAuth, requireWorkspaceContext, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const tenantId = authReq.workspace.tenantId;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, name, created_at, updated_at,
         (SELECT COUNT(*) FROM documents WHERE folder_id = folders.id) as document_count
         FROM folders 
         WHERE tenant_id = $1 
         ORDER BY name ASC`,
        [tenantId]
      );

      res.json({
        success: true,
        folders: result.rows,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({
      error: 'Failed to fetch folders',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Create folder
router.post('/', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid folder name',
      message: 'Folder name is required',
    });
  }

  const folderName = name.trim();

  if (folderName.length > 255) {
    return res.status(400).json({
      error: 'Invalid folder name',
      message: 'Folder name must be 255 characters or less',
    });
  }

  try {
    const client = await pool.connect();
    try {
      // Check if folder with same name already exists
      const existing = await client.query(
        `SELECT id FROM folders WHERE tenant_id = $1 AND name = $2`,
        [tenantId, folderName]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Folder already exists',
          message: `A folder named "${folderName}" already exists`,
        });
      }

      // Create folder
      const result = await client.query(
        `INSERT INTO folders (tenant_id, user_id, name) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, created_at, updated_at`,
        [tenantId, userId, folderName]
      );

      const folder = result.rows[0] as { id: string; name: string; created_at: Date; updated_at: Date };

      // Log audit event
      await logAuditEvent(
        userId,
        'folder_created',
        'folder',
        folder.id,
        {
          folderName: folder.name,
          tenantId,
        },
        req.ip,
        req.get('user-agent'),
        ['soc2', 'gdpr']
      );

      res.status(201).json({
        success: true,
        folder: {
          ...folder,
          document_count: 0,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      error: 'Failed to create folder',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update folder name
router.put('/:folderId', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  const { folderId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid folder name',
      message: 'Folder name is required',
    });
  }

  const folderName = name.trim();

  try {
    const client = await pool.connect();
    try {
      // Verify ownership
      const folder = await client.query(
        `SELECT id, name FROM folders WHERE id = $1 AND tenant_id = $2`,
        [folderId, tenantId]
      );

      if (folder.rows.length === 0) {
        return res.status(404).json({
          error: 'Folder not found',
          message: 'The specified folder does not exist',
        });
      }

      // Check if another folder with same name exists
      const existing = await client.query(
        `SELECT id FROM folders WHERE tenant_id = $1 AND name = $2 AND id != $3`,
        [tenantId, folderName, folderId]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Folder name already exists',
          message: `A folder named "${folderName}" already exists`,
        });
      }

      // Update folder
      const result = await client.query(
        `UPDATE folders 
         SET name = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND tenant_id = $3
         RETURNING id, name, created_at, updated_at`,
        [folderName, folderId, tenantId]
      );

      // Log audit event
      await logAuditEvent(
        userId,
        'folder_updated',
        'folder',
        folderId,
        {
          oldName: (folder.rows[0] as Record<string, unknown>).name as string,
          newName: folderName,
          tenantId,
        },
        req.ip,
        req.get('user-agent'),
        ['soc2', 'gdpr']
      );

      res.json({
        success: true,
        folder: result.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({
      error: 'Failed to update folder',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Delete folder
router.delete('/:folderId', requireAuth, requireWorkspaceContext, requireWorkspaceRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  const { folderId } = req.params;

  try {
    const client = await pool.connect();
    try {
      // Verify ownership
      const folder = await client.query(
        `SELECT id, name FROM folders WHERE id = $1 AND tenant_id = $2`,
        [folderId, tenantId]
      );

      if (folder.rows.length === 0) {
        return res.status(404).json({
          error: 'Folder not found',
          message: 'The specified folder does not exist',
        });
      }

      // Delete folder (documents will have folder_id set to NULL due to ON DELETE SET NULL)
      await client.query(
        `DELETE FROM folders WHERE id = $1 AND tenant_id = $2`,
        [folderId, tenantId]
      );

      // Log audit event
      await logAuditEvent(
        userId,
        'folder_deleted',
        'folder',
        folderId,
        {
          folderName: (folder.rows[0] as Record<string, unknown>).name as string,
          tenantId,
        },
        req.ip,
        req.get('user-agent'),
        ['soc2', 'gdpr']
      );

      res.json({
        success: true,
        message: 'Folder deleted successfully',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      error: 'Failed to delete folder',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Move document to folder
router.post(
  '/:folderId/documents/:documentId',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin']),
  async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  const { folderId, documentId } = req.params;

  try {
    const client = await pool.connect();
    try {
      // Verify folder ownership
      const folder = await client.query(
        `SELECT id FROM folders WHERE id = $1 AND tenant_id = $2`,
        [folderId, tenantId]
      );

      if (folder.rows.length === 0) {
        return res.status(404).json({
          error: 'Folder not found',
          message: 'The specified folder does not exist',
        });
      }

      // Verify document ownership
      const document = await client.query(
        `SELECT id, filename FROM documents WHERE id = $1 AND tenant_id = $2`,
        [documentId, tenantId]
      );

      if (document.rows.length === 0) {
        return res.status(404).json({
          error: 'Document not found',
          message: 'The specified document does not exist',
        });
      }

      // Move document to folder
      await setDocumentFolderByTenant({ documentId, tenantId, folderId });

      // Log audit event
      await logAuditEvent(
        userId,
        'document_moved',
        'document',
        documentId,
        {
          filename: (document.rows[0] as Record<string, unknown>).filename as string,
          folderId: folderId,
          tenantId,
        },
        req.ip,
        req.get('user-agent'),
        ['soc2', 'gdpr']
      );

      res.json({
        success: true,
        message: 'Document moved to folder successfully',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error moving document:', error);
    res.status(500).json({
      error: 'Failed to move document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Remove document from folder (move to root)
router.delete(
  '/:folderId/documents/:documentId',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin']),
  async (req: Request, res: Response) => {
  const authReq = req as WorkspaceRequest;

  if (!authReq.user?.id || !authReq.workspace?.tenantId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const tenantId = authReq.workspace.tenantId;
  const { folderId, documentId } = req.params;

  try {
    const client = await pool.connect();
    try {
      // Verify folder ownership
      const folder = await client.query(
        `SELECT id FROM folders WHERE id = $1 AND tenant_id = $2`,
        [folderId, tenantId]
      );

      if (folder.rows.length === 0) {
        return res.status(404).json({
          error: 'Folder not found',
          message: 'The specified folder does not exist',
        });
      }

      // Verify document ownership and that it's in this folder
      const document = await client.query(
        `SELECT id, filename FROM documents WHERE id = $1 AND tenant_id = $2 AND folder_id = $3`,
        [documentId, tenantId, folderId]
      );

      if (document.rows.length === 0) {
        return res.status(404).json({
          error: 'Document not found in folder',
          message: 'The specified document is not in this folder',
        });
      }

      // Remove document from folder (set folder_id to NULL)
      await setDocumentFolderByTenant({ documentId, tenantId, folderId: null });

      // Log audit event
      await logAuditEvent(
        userId,
        'document_removed_from_folder',
        'document',
        documentId,
        {
          filename: (document.rows[0] as Record<string, unknown>).filename as string,
          folderId: folderId,
          tenantId,
        },
        req.ip,
        req.get('user-agent'),
        ['soc2', 'gdpr']
      );

      res.json({
        success: true,
        message: 'Document removed from folder successfully',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error removing document from folder:', error);
    res.status(500).json({
      error: 'Failed to remove document from folder',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
