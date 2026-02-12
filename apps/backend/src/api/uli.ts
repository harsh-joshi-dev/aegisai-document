/**
 * ULI (Unified Lending Interface) API
 * Request documents with consent, fetch from GSTN/IT/UIDAI/AA
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { requestULIDocuments, getStoredDocuments, getConsentsByDataPrincipal, getRemainingCalls } from '../integrations/uli/index.js';

const router = Router();

const fetchSchema = z.object({
  consentId: z.string().min(1),
  dataPrincipalId: z.string().min(1),
  purpose: z.string().min(1),
  types: z.array(z.enum(['gst', 'itr', 'bank', 'aadhaar'])).min(1),
  aaConsentHandle: z.string().optional(),
  retentionDays: z.number().int().min(1).max(365).optional().default(90),
});

router.post('/fetch', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = fetchSchema.parse(req.body);
    const result = await requestULIDocuments(
      {
        consentId: body.consentId,
        dataPrincipalId: body.dataPrincipalId,
        purpose: body.purpose,
        types: body.types,
        aaConsentHandle: body.aaConsentHandle,
      },
      body.retentionDays
    );
    res.json({
      success: result.success,
      consentId: result.consentId,
      documents: result.documents,
      errors: result.errors,
      remainingCallsPerMinute: getRemainingCalls(),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: e.errors });
    }
    console.error('ULI fetch error:', e);
    res.status(500).json({
      error: 'ULI fetch failed',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.get('/cached/:consentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { consentId } = req.params;
    const cached = await getStoredDocuments(consentId);
    if (!cached) {
      return res.status(404).json({ error: 'No cached documents for this consent or expired' });
    }
    res.json({ ...cached, success: cached.success });
  } catch (e) {
    console.error('ULI cached error:', e);
    res.status(500).json({
      error: 'Failed to get cached documents',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.get('/consents', requireAuth, async (req: Request, res: Response) => {
  try {
    const dataPrincipalId = req.query.dataPrincipalId as string;
    if (!dataPrincipalId) {
      return res.status(400).json({ error: 'dataPrincipalId query required' });
    }
    const consents = await getConsentsByDataPrincipal(dataPrincipalId);
    res.json({ success: true, consents });
  } catch (e) {
    console.error('ULI consents error:', e);
    res.status(500).json({
      error: 'Failed to list consents',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

router.get('/rate-limit', requireAuth, async (_req: Request, res: Response) => {
  res.json({ success: true, remainingCallsPerMinute: getRemainingCalls() });
});

export default router;
