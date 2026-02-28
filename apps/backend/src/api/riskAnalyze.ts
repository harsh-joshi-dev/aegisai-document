/**
 * Risk AI Analysis API – Aegis AI Decision Workspace
 * POST /api/risk/analyze-ai – analyze document text with LLM, return risk signals.
 */

import express, { Request, Response } from 'express';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { z } from 'zod';

const router = express.Router();

const bodySchema = z.object({
  documentId: z.string(),
  tenantId: z.string(),
  text: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

let llm: InstanceType<typeof ChatOpenAI> | null = null;

function getLLM(): InstanceType<typeof ChatOpenAI> {
  if (!llm) {
    if (!config.openai?.apiKey) throw new Error('OPENAI_API_KEY not set');
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 1024,
    });
  }
  return llm;
}

/**
 * Analyze document text with OpenAI; return risk signals for frontend Risk Engine.
 */
router.post('/analyze-ai', async (req: Request, res: Response) => {
  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() });
  }

  const { documentId, tenantId, text, metadata } = parse.data;

  if (!config.openai?.apiKey) {
    return res.json({ signals: [], message: 'OpenAI not configured' });
  }

  try {
    const model = getLLM();
    const prompt = `Analyze this financial document excerpt and identify ONLY substantiated risks.
Do not generate generic checks. Raise a finding only when there is clear, document-specific evidence in the provided text.
GST-related findings are allowed only when the document is clearly GST/tax/invoice related and evidence mentions GST/tax context.
Return ONLY a JSON object with a key "findings" that is an array. Each finding must have:
- title (string)
- description (string)
- severity (one of: LOW, MEDIUM, HIGH, CRITICAL)
- recommendation (string)
- confidenceScore (number 0-100)
- evidence (array of exact short quotes copied from the document text)
If no risks found, return {"findings":[]}.

Document type: ${(metadata?.docType as string) || 'unknown'}
Amount: ${(metadata?.amount as number) ?? 'not provided'}
Vendor: ${(metadata?.vendor as string) ?? 'not provided'}

Document text:
${text.slice(0, 6000)}`;

    const response = await model.invoke(prompt);
    const raw = (typeof response.content === 'string' ? response.content : '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const rawJson = jsonMatch ? jsonMatch[0] : '{}';
    let findings: Array<{
      title: string;
      description: string;
      severity: string;
      recommendation: string;
      confidenceScore?: number;
      evidence?: string[];
    }> = [];
    try {
      const parsed = JSON.parse(rawJson);
      findings = Array.isArray(parsed.findings) ? parsed.findings : Array.isArray(parsed) ? parsed : [];
    } catch {
      findings = [];
    }

    const lowerText = text.toLowerCase();
    const lowerDocType = String((metadata?.docType as string) || '').toLowerCase();
    const isGstRelevantDocument =
      /gst|tax|invoice/.test(lowerDocType) || /gst|gstin|tax invoice|cgst|sgst|igst/.test(lowerText);

    const filteredFindings = findings.filter((f) => {
      const confidence = typeof f.confidenceScore === 'number' ? f.confidenceScore : 0;
      if (confidence < 65) {
        return false;
      }

      const evidence = Array.isArray(f.evidence) ? f.evidence.filter((e) => typeof e === 'string' && e.trim().length > 0) : [];
      const hasValidEvidence = evidence.some((snippet) => lowerText.includes(snippet.toLowerCase()));
      if (!hasValidEvidence) {
        return false;
      }

      const findingText = `${f.title || ''} ${f.description || ''}`.toLowerCase();
      if (/gst|gstin|tax/.test(findingText) && !isGstRelevantDocument) {
        return false;
      }

      return true;
    });

    const signals = filteredFindings.map((f, i) => ({
      id: `ai-${documentId}-${Date.now()}-${i}`,
      documentId,
      tenantId,
      type: 'AI',
      severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(f.severity).toUpperCase()) ? String(f.severity).toUpperCase() : 'MEDIUM',
      title: f.title || 'AI finding',
      description: f.description || '',
      confidenceScore: typeof f.confidenceScore === 'number' ? f.confidenceScore : 70,
      recommendation: f.recommendation || 'Review document.',
      createdAt: new Date().toISOString(),
    }));

    res.json({ signals });
  } catch (err) {
    console.error('Risk analyze-ai error:', err);
    res.status(500).json({ error: 'AI analysis failed', signals: [] });
  }
});

export default router;
