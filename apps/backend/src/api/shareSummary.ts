/**
 * Share Safe Summary: generate a clean, redacted shareable summary (no sensitive data). One-click share.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { getDocuments, getDocumentContent } from '../db/pgvector.js';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

const router = Router();

let llm: InstanceType<typeof ChatOpenAI> | null = null;

function getLLM() {
  if (!llm) {
    if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY is not set');
    llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
    });
  }
  return llm;
}

const schema = z.object({
  documentId: z.string().uuid(),
  title: z.string().optional(), // e.g. "Summary of Rent Agreement"
});

router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { documentId, title } = schema.parse(req.body);

    const docs = await getDocuments({ userId: authReq.user!.id, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const content = await getDocumentContent(documentId);
    const doc = docs[0] as { filename: string };
    const summaryTitle = title || `Summary of ${doc.filename}`;

    if (!content) {
      return res.json({
        success: true,
        documentId,
        title: summaryTitle,
        summary: 'Document content not available. No sensitive data included.',
        shareableText: `Summary: ${summaryTitle} – No sensitive data.`,
      });
    }

    const prompt = `You are a document summarizer. Create a SHAREABLE, REDACTED summary of this document that is safe to share externally.
- Do NOT include: names, addresses, phone numbers, email, bank details, Aadhaar/PAN, signatures, exact amounts, dates of birth, or any PII.
- DO include: document type, general purpose, key non-identifying terms (e.g. "monthly rent", "12 months"), and high-level obligations.
- Output should be 1-3 short paragraphs. End with: "No sensitive data included."

Document filename: ${doc.filename}

Content (first 5000 chars):
${content.substring(0, 5000)}

Return ONLY a JSON object: { "summary": "paragraphs of text", "shareableText": "one line for link preview" }`;

    const response = await getLLM().invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let summary = 'Summary not available.';
    let shareableText = summaryTitle + ' – No sensitive data.';
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.summary) summary = parsed.summary;
      if (parsed.shareableText) shareableText = parsed.shareableText;
    } catch {
      summary = 'A redacted summary could not be generated. No sensitive data included.';
    }

    res.json({
      success: true,
      documentId,
      title: summaryTitle,
      summary,
      shareableText,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: e.errors });
    console.error('Share summary error:', e);
    res.status(500).json({
      error: 'Failed to generate shareable summary',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
