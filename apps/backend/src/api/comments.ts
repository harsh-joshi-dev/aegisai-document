/**
 * Internal comments & notes on documents. Team members can add notes, tag colleagues (mentions).
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import { pool } from '../db/pgvector.js';

const router = Router();

const createSchema = z.object({
  documentId: z.string().uuid(),
  content: z.string().min(1),
  mentions: z.array(z.string().uuid()).optional(),
});

router.get('/:documentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const documentId = req.params.documentId;

    const docs = await getDocuments({ userId: authReq.user!.id, documentIds: [documentId] });
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    const result = await pool.query(
      `SELECT id, document_id, user_id, content, mentions, created_at, updated_at
       FROM document_comments WHERE document_id = $1 ORDER BY created_at ASC`,
      [documentId]
    );

    res.json({ success: true, comments: result.rows });
  } catch (e) {
    console.error('Comments list error:', e);
    res.status(500).json({ error: 'Failed to list comments', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = createSchema.parse(req.body);

    const docs = await getDocuments({ userId: authReq.user!.id, documentIds: [body.documentId] });
    if (docs.length === 0) return res.status(404).json({ error: 'Document not found' });

    const result = await pool.query(
      `INSERT INTO document_comments (document_id, user_id, content, mentions)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.documentId, authReq.user!.id, body.content, body.mentions ? body.mentions : []]
    );

    res.status(201).json({ success: true, comment: result.rows[0] });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: e.errors });
    console.error('Comment create error:', e);
    res.status(500).json({ error: 'Failed to create comment', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.put('/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { content } = req.body as { content?: string };
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await pool.query(
      `UPDATE document_comments SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [content.trim(), req.params.commentId, authReq.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

    res.json({ success: true, comment: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update comment', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.delete('/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await pool.query(
      `DELETE FROM document_comments WHERE id = $1 AND user_id = $2`,
      [req.params.commentId, authReq.user!.id]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Comment not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete comment', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
