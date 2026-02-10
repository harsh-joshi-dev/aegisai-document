import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments } from '../db/pgvector.js';
import {
  insertDeadline,
  getDeadlinesByDocument,
  getDeadlinesByUser,
  markDeadlineReminderSent,
  markDeadlineCalendarSynced,
  deleteDeadline,
} from '../db/deadlines.js';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const documentId = req.query.documentId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    if (documentId) {
      const docs = await getDocuments({ userId, documentIds: [documentId] });
      if (docs.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }
      const deadlines = await getDeadlinesByDocument(documentId, userId);
      return res.json({ success: true, deadlines });
    }

    const deadlines = await getDeadlinesByUser(userId, { from, to });
    res.json({ success: true, deadlines });
  } catch (e) {
    console.error('Deadlines list error:', e);
    res.status(500).json({ error: 'Failed to list deadlines', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

const createSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.string().min(1),
  due_type: z.string().optional(),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']).optional(),
  assignee_type: z.string().optional(),
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const body = createSchema.parse(req.body);

    const docs = await getDocuments({ userId, documentIds: [body.documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const deadline = await insertDeadline(body.documentId, userId, {
      title: body.title,
      description: body.description,
      due_date: body.due_date,
      due_type: body.due_type,
      severity: body.severity || 'Medium',
      assignee_type: body.assignee_type,
    });

    res.status(201).json({ success: true, deadline });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('Create deadline error:', e);
    res.status(500).json({ error: 'Failed to create deadline', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/:id/reminder-sent', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await markDeadlineReminderSent(req.params.id, authReq.user!.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.post('/:id/calendar-synced', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    await markDeadlineCalendarSynced(req.params.id, authReq.user!.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const deleted = await deleteDeadline(req.params.id, authReq.user!.id);
    if (!deleted) return res.status(404).json({ error: 'Deadline not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

/** Calendar export (iCal-style) for user's deadlines */
router.get('/export/ical', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const deadlines = await getDeadlinesByUser(authReq.user!.id, { from, to });

    let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Aegis//Deadlines//EN\n';
    for (const d of deadlines) {
      const start = (d as { due_date: string }).due_date.replace(/-/g, '');
      ical += 'BEGIN:VEVENT\n';
      ical += `UID:${(d as { id: string }).id}@aegis\n`;
      ical += `DTSTART:${start}\n`;
      ical += `DTEND:${start}\n`;
      ical += `SUMMARY:${(d as { title: string }).title.replace(/\n/g, ' ')}\n`;
      if ((d as { description?: string }).description) {
        ical += `DESCRIPTION:${(d as { description: string }).description.replace(/\n/g, ' ')}\n`;
      }
      ical += 'END:VEVENT\n';
    }
    ical += 'END:VCALENDAR';

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="aegis-deadlines.ics"');
    res.send(ical);
  } catch (e) {
    res.status(500).json({ error: 'Export failed', message: e instanceof Error ? e.message : 'Unknown error' });
  }
});

export default router;
