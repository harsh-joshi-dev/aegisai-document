/**
 * Auto-generated replies & drafts: legal replies, email responses, appeal drafts.
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
      temperature: 0.3,
    });
  }
  return llm;
}

const schema = z.object({
  documentId: z.string().uuid(),
  type: z.enum(['legal_reply', 'email_response', 'appeal_draft']),
  userIntent: z.string().optional(), // e.g. "dispute the penalty"
});

router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { documentId, type, userIntent } = schema.parse(req.body);

    const docs = await getDocuments({ userId: authReq.user!.id, documentIds: [documentId] });
    if (docs.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const content = await getDocumentContent(documentId);
    const doc = docs[0] as { filename: string };

    if (!content) {
      return res.json({
        success: true,
        documentId,
        type,
        draft: 'Document content not available. Please upload the document and try again.',
        disclaimer: 'This is AI-generated. Have a professional review before sending.',
      });
    }

    const typeInstructions = {
      legal_reply: 'Draft a formal legal reply to this document. Use professional legal language. Include reference to the document, date, and clear response to each point that requires a reply.',
      email_response: 'Draft a professional email response to this document. Be clear and concise. Acknowledge receipt and state next steps or request.',
      appeal_draft: 'Draft an appeal or representation in response to this document. Structure: introduction, grounds of appeal, request for relief, closing.',
    };

    const prompt = `You are a legal/business writing assistant. Generate a ${type} based on this document.

Document: ${doc.filename}
${userIntent ? `User's intent: ${userIntent}` : ''}

Document content (first 5000 chars):
${content.substring(0, 5000)}

Instructions: ${typeInstructions[type as keyof typeof typeInstructions]}

Return ONLY a JSON object: { "draft": "full text of the draft", "subject": "subject line if email" }
Do not include names/addresses; use placeholders like [Your Name], [Date].`;

    const response = await getLLM().invoke(prompt);
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let draft = 'Draft could not be generated.';
    let subject = '';
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.draft) draft = parsed.draft;
      if (parsed.subject) subject = parsed.subject;
    } catch {
      draft = 'Unable to generate draft. Please try again or consult a professional.';
    }

    res.json({
      success: true,
      documentId,
      type,
      draft,
      subject: subject || undefined,
      disclaimer: 'This is AI-generated. Have a lawyer or professional review before sending.',
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: e.errors });
    console.error('Drafts error:', e);
    res.status(500).json({
      error: 'Failed to generate draft',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
});

export default router;
