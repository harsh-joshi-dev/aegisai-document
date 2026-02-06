import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseDocument, isSupportedFileType } from '../services/documentParser.js';
import { chunkText } from '../services/chunker.js';
import { generateEmbeddings } from '../services/embeddings.js';
import { insertDocument, insertChunks, updateDocumentRiskLevel } from '../db/pgvector.js';
import { classifyDocumentRisk } from '../services/classifier.js';
import { sanitizeForAnalysis } from '../redaction/sanitizer.js';
import { evaluateRules } from '../rules/ruleEngine.js';
import { getEnabledRules } from '../rules/rulesStorage.js';
import { logAuditEvent } from '../compliance/auditLog.js';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';
import { checkDocumentLimit, MAX_DOCUMENTS_PER_USER } from '../db/userLimits.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Shared helper to enforce per-user document limit
async function ensureDocumentLimit(userId: string, res: Response) {
  const limitCheck = await checkDocumentLimit(userId);
  if (!limitCheck.allowed) {
    res.status(403).json({
      error: 'Document limit reached',
      message: `You have reached the maximum limit of ${limitCheck.maxCount} documents. Please delete some documents to upload more.`,
      currentCount: limitCheck.currentCount,
      maxCount: limitCheck.maxCount,
    });
    return false;
  }
  return true;
}

router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;

  // Check document limit
  const allowed = await ensureDocumentLimit(userId, res);
  if (!allowed) return;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check if file type is supported
    if (!isSupportedFileType(req.file.mimetype, req.file.originalname)) {
      return res.status(400).json({ 
        error: 'Unsupported file type',
        message: 'Supported file types: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, WEBP',
        receivedType: req.file.mimetype || 'unknown',
      });
    }
    
    // Validate file size
    if (req.file.size === 0) {
      return res.status(400).json({ error: 'PDF file is empty' });
    }
    
    if (req.file.size > 50 * 1024 * 1024) { // 50MB limit
      return res.status(400).json({ error: 'PDF file is too large. Maximum size is 50MB' });
    }
    
    // Parse document with enhanced error handling
    let parsed;
    try {
      parsed = await parseDocument(req.file.buffer, req.file.mimetype, req.file.originalname);
      
      // Log warnings if any
      if (parsed.warnings && parsed.warnings.length > 0) {
        console.warn('PDF parsing warnings:', parsed.warnings);
      }
    } catch (error) {
      console.error('PDF parsing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'The PDF may be corrupted or in an unsupported format';
      
      // Provide specific error responses
      if (errorMessage.includes('XRef') || errorMessage.includes('corrupted')) {
        return res.status(400).json({ 
          error: 'PDF is corrupted',
          message: errorMessage,
          suggestions: [
            'Try re-saving the PDF from the original source',
            'Use a PDF repair tool to fix the file',
            'Convert the PDF to a new file format',
            'Check if the PDF is password-protected'
          ]
        });
      }
      
      if (errorMessage.includes('No text content') || errorMessage.includes('image-only')) {
        return res.status(400).json({ 
          error: 'No text content found',
          message: errorMessage,
          suggestions: [
            'The document may contain only images without extractable text',
            'OCR is being attempted automatically',
            'If OCR fails, try using a document with selectable text',
            'Check if the document is a scanned image (OCR may take longer)'
          ]
        });
      }
      
      return res.status(400).json({ 
        error: 'Failed to parse PDF',
        message: errorMessage,
        suggestions: [
          'Verify the file is a valid PDF',
          'Check if the PDF is password-protected',
          'Try opening the PDF in a PDF viewer first',
          'Re-save or convert the PDF to a new file'
        ]
      });
    }
    
    // Additional validation for parsed text
    if (!parsed.text || parsed.text.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No text content found in PDF',
        message: 'The PDF was parsed successfully but contains no extractable text. This may be an image-only PDF.',
        suggestions: [
          'The PDF may contain only images without text',
          'Try using OCR to extract text from images',
          'Use a PDF with selectable text content',
          'Check if this is a scanned document'
        ]
      });
    }
    
    // Optional: Sanitize PII before analysis (if requested)
    const sanitizePII = req.body.sanitizePII === 'true' || req.body.sanitizePII === true;
    let textForAnalysis = parsed.text;
    let redactionSummary = null;
    
    if (sanitizePII) {
      const sanitized = await sanitizeForAnalysis(parsed.text);
      textForAnalysis = sanitized;
      // Note: In production, you'd want to store original separately
    }
    
    // Evaluate custom rules (if any)
    let customRuleMatches = [];
    try {
      const enabledRules = await getEnabledRules();
      if (enabledRules.length > 0) {
        customRuleMatches = await evaluateRules(textForAnalysis, enabledRules);
      }
    } catch (error) {
      console.warn('Custom rules evaluation failed:', error);
      // Continue without custom rules
    }
    
    // Classify document risk (with error handling)
    let riskAnalysis;
    try {
      riskAnalysis = await classifyDocumentRisk(textForAnalysis);
    } catch (error) {
      console.warn('Classification failed, defaulting to Normal:', error);
      // Continue with default risk analysis
      riskAnalysis = {
        riskLevel: 'Normal' as const,
        riskCategory: 'None' as const,
        confidence: 0.5,
        explanation: 'Classification service unavailable. Document processed with default risk level.',
        recommendations: ['Review document manually', 'Verify content is appropriate']
      };
    }
    
    // Insert document with user_id and file data
    let document;
    try {
      document = await insertDocument(
        req.file.originalname,
        userId,
        {
          numPages: parsed.numPages,
          ...parsed.metadata,
        },
        riskAnalysis.riskCategory || 'None',
        riskAnalysis.confidence || 0.5,
        1, // versionNumber
        undefined, // parentDocumentId
        req.file.buffer, // Store original file
        req.file.mimetype // Store file type
      );
    } catch (error) {
      console.error('Error inserting document:', error);
      throw new Error(`Failed to insert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Update risk level
    try {
      await updateDocumentRiskLevel(
        document.id, 
        riskAnalysis.riskLevel,
        riskAnalysis.riskCategory || 'None',
        riskAnalysis.confidence || 0.5
      );
    } catch (error) {
      console.warn('Error updating document risk level:', error);
      // Continue - document is already inserted
    }
    
    // Chunk text (use sanitized text if PII was redacted)
    const chunks = chunkText(textForAnalysis, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    // Filter out empty chunks and validate content
    const validChunks = chunks.filter(chunk => {
      const content = chunk.content.trim();
      return content.length > 0 && content.length <= 8000; // OpenAI has token limits
    });
    
    if (validChunks.length === 0) {
      return res.status(400).json({ 
        error: 'No valid text content found in PDF',
        message: 'The PDF may be empty, corrupted, or contain only images without text'
      });
    }
    
    // Generate embeddings for all valid chunks
    let embeddings: number[][];
    try {
      const chunkTexts = validChunks.map(chunk => chunk.content);
      embeddings = await generateEmbeddings(chunkTexts);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Prepare chunks with embeddings (only valid chunks)
    const chunksWithEmbeddings = validChunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: embeddings[index] || [],
      metadata: chunk.metadata,
    }));
    
    // Insert chunks into database
    try {
      await insertChunks(document.id, chunksWithEmbeddings);
    } catch (error) {
      console.error('Error inserting chunks:', error);
      throw new Error(`Failed to insert chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Send email notification (async, don't block)
    try {
      const { sendDocumentUploadEmail } = await import('../services/emailService.js');
      const userEmail = authReq.user.email;
      const userName = authReq.user.name || 'User';
      
      sendDocumentUploadEmail(
        userEmail,
        userName,
        req.file.originalname,
        document.id,
        riskAnalysis.riskLevel,
        riskAnalysis.riskCategory || null,
        riskAnalysis.confidence || null,
        riskAnalysis.explanation || null,
        riskAnalysis.recommendations || [],
        parsed.numPages || 0,
        validChunks.length
      ).catch(err => {
        console.error('Failed to send document upload email:', err);
      });
    } catch (error) {
      console.error('Error preparing document upload email:', error);
      // Continue - email failures shouldn't break upload
    }

    // Log audit event
    await logAuditEvent(
      userId,
      'document_upload',
      'document',
      document.id,
      {
        filename: req.file.originalname,
        riskLevel: riskAnalysis.riskLevel,
        numPages: parsed.numPages,
        numChunks: chunksWithEmbeddings.length,
      },
      req.ip,
      req.get('user-agent'),
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        uploadedAt: document.uploaded_at,
        riskLevel: riskAnalysis.riskLevel,
        riskCategory: riskAnalysis.riskCategory,
        riskConfidence: Math.round(riskAnalysis.confidence * 100), // Convert to percentage
        riskExplanation: riskAnalysis.explanation,
        recommendations: riskAnalysis.recommendations,
        numPages: parsed.numPages,
        numChunks: chunksWithEmbeddings.length,
        customRuleMatches: customRuleMatches.length > 0 ? customRuleMatches : undefined,
        redactionSummary: redactionSummary,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    res.status(500).json({
      error: 'Failed to process document',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.stack : String(error))
        : undefined,
    });
  }
});

/**
 * Upload raw text as a virtual document
 * This is used for pasted text snippets or notes.
 */
router.post('/text', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const { title, content, sanitizePII } = req.body as {
    title?: string;
    content?: string;
    sanitizePII?: boolean | string;
  };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({
      error: 'No text provided',
      message: 'Please provide some text content to upload.',
    });
  }

  const allowed = await ensureDocumentLimit(userId, res);
  if (!allowed) return;

  const filename = (title && String(title).trim()) || 'Pasted text';

  try {
    const parsed = {
      text: content,
      numPages: 1,
      metadata: {
        fileType: 'text',
      },
    };

    // Optional PII sanitization
    const shouldSanitize =
      sanitizePII === true || sanitizePII === 'true';
    let textForAnalysis = parsed.text;

    if (shouldSanitize) {
      const sanitized = await sanitizeForAnalysis(parsed.text);
      textForAnalysis = sanitized;
    }

    // Evaluate custom rules (if any)
    let customRuleMatches: any[] = [];
    try {
      const enabledRules = await getEnabledRules();
      if (enabledRules.length > 0) {
        customRuleMatches = await evaluateRules(textForAnalysis, enabledRules);
      }
    } catch (error) {
      console.warn('Custom rules evaluation failed for text upload:', error);
    }

    // Classify document risk
    let riskAnalysis;
    try {
      riskAnalysis = await classifyDocumentRisk(textForAnalysis);
    } catch (error) {
      console.warn('Classification failed for text upload, defaulting to Normal:', error);
      riskAnalysis = {
        riskLevel: 'Normal' as const,
        riskCategory: 'None' as const,
        confidence: 0.5,
        explanation: 'Classification service unavailable. Document processed with default risk level.',
        recommendations: ['Review document manually', 'Verify content is appropriate'],
      };
    }

    // Insert virtual document (no binary file)
    const document = await insertDocument(
      filename,
      userId,
      {
        ...parsed.metadata,
        source: 'text',
      },
      riskAnalysis.riskCategory || 'None',
      riskAnalysis.confidence || 0.5,
      1
    );

    // Update risk level
    try {
      await updateDocumentRiskLevel(
        document.id,
        riskAnalysis.riskLevel,
        riskAnalysis.riskCategory || 'None',
        riskAnalysis.confidence || 0.5
      );
    } catch (error) {
      console.warn('Error updating document risk level (text upload):', error);
    }

    // Chunk text
    const chunks = chunkText(textForAnalysis, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const validChunks = chunks.filter((chunk) => {
      const c = chunk.content.trim();
      return c.length > 0 && c.length <= 8000;
    });

    if (validChunks.length === 0) {
      return res.status(400).json({
        error: 'No valid text content found',
        message: 'Provided text is empty or too long to process.',
      });
    }

    // Generate embeddings
    const embeddings = await generateEmbeddings(
      validChunks.map((chunk) => chunk.content)
    );

    const chunksWithEmbeddings = validChunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: embeddings[index] || [],
      metadata: chunk.metadata,
    }));

    await insertChunks(document.id, chunksWithEmbeddings);

    // Log audit event
    await logAuditEvent(
      userId,
      'document_upload_text',
      'document',
      document.id,
      {
        filename,
        riskLevel: riskAnalysis.riskLevel,
        numPages: parsed.numPages,
        numChunks: chunksWithEmbeddings.length,
      },
      (req as any).ip,
      (req as any).get?.('user-agent'),
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        uploadedAt: document.uploaded_at,
        riskLevel: riskAnalysis.riskLevel,
        riskCategory: riskAnalysis.riskCategory,
        riskConfidence: Math.round((riskAnalysis.confidence || 0.5) * 100),
        riskExplanation: riskAnalysis.explanation,
        recommendations: riskAnalysis.recommendations,
        numPages: parsed.numPages,
        numChunks: chunksWithEmbeddings.length,
        customRuleMatches: customRuleMatches.length > 0 ? customRuleMatches : undefined,
      },
    });
  } catch (error) {
    console.error('Text upload error:', error);
    res.status(500).json({
      error: 'Failed to process text document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Upload an email (e.g., pasted from Gmail) as a document.
 */
router.post('/email', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = authReq.user.id;
  const { subject, body, sanitizePII } = req.body as {
    subject?: string;
    body?: string;
    sanitizePII?: boolean | string;
  };

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({
      error: 'No email body provided',
      message: 'Please provide the email body text.',
    });
  }

  const allowed = await ensureDocumentLimit(userId, res);
  if (!allowed) return;

  const safeSubject = (subject && String(subject).trim()) || 'Email from Gmail';
  const content = `Subject: ${safeSubject}\n\n${body}`;

  try {
    const parsed = {
      text: content,
      numPages: 1,
      metadata: {
        fileType: 'email',
        subject: safeSubject,
        source: 'gmail',
      },
    };

    const shouldSanitize =
      sanitizePII === true || sanitizePII === 'true';
    let textForAnalysis = parsed.text;

    if (shouldSanitize) {
      const sanitized = await sanitizeForAnalysis(parsed.text);
      textForAnalysis = sanitized;
    }

    // Evaluate rules
    let customRuleMatches: any[] = [];
    try {
      const enabledRules = await getEnabledRules();
      if (enabledRules.length > 0) {
        customRuleMatches = await evaluateRules(textForAnalysis, enabledRules);
      }
    } catch (error) {
      console.warn('Custom rules evaluation failed for email upload:', error);
    }

    // Classify risk
    let riskAnalysis;
    try {
      riskAnalysis = await classifyDocumentRisk(textForAnalysis);
    } catch (error) {
      console.warn('Classification failed for email upload, defaulting to Normal:', error);
      riskAnalysis = {
        riskLevel: 'Normal' as const,
        riskCategory: 'None' as const,
        confidence: 0.5,
        explanation: 'Classification service unavailable. Document processed with default risk level.',
        recommendations: ['Review email manually', 'Verify content is appropriate'],
      };
    }

    const document = await insertDocument(
      safeSubject,
      userId,
      parsed.metadata,
      riskAnalysis.riskCategory || 'None',
      riskAnalysis.confidence || 0.5,
      1
    );

    try {
      await updateDocumentRiskLevel(
        document.id,
        riskAnalysis.riskLevel,
        riskAnalysis.riskCategory || 'None',
        riskAnalysis.confidence || 0.5
      );
    } catch (error) {
      console.warn('Error updating document risk level (email upload):', error);
    }

    const chunks = chunkText(textForAnalysis, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const validChunks = chunks.filter((chunk) => {
      const c = chunk.content.trim();
      return c.length > 0 && c.length <= 8000;
    });

    if (validChunks.length === 0) {
      return res.status(400).json({
        error: 'No valid text content found in email',
        message: 'The email content is empty or too long to process.',
      });
    }

    const embeddings = await generateEmbeddings(
      validChunks.map((chunk) => chunk.content)
    );

    const chunksWithEmbeddings = validChunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: embeddings[index] || [],
      metadata: chunk.metadata,
    }));

    await insertChunks(document.id, chunksWithEmbeddings);

    await logAuditEvent(
      userId,
      'document_upload_email',
      'document',
      document.id,
      {
        filename: safeSubject,
        riskLevel: riskAnalysis.riskLevel,
        numPages: parsed.numPages,
        numChunks: chunksWithEmbeddings.length,
      },
      (req as any).ip,
      (req as any).get?.('user-agent'),
      ['soc2', 'gdpr']
    );

    res.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        uploadedAt: document.uploaded_at,
        riskLevel: riskAnalysis.riskLevel,
        riskCategory: riskAnalysis.riskCategory,
        riskConfidence: Math.round((riskAnalysis.confidence || 0.5) * 100),
        riskExplanation: riskAnalysis.explanation,
        recommendations: riskAnalysis.recommendations,
        numPages: parsed.numPages,
        numChunks: chunksWithEmbeddings.length,
        customRuleMatches: customRuleMatches.length > 0 ? customRuleMatches : undefined,
      },
    });
  } catch (error) {
    console.error('Email upload error:', error);
    res.status(500).json({
      error: 'Failed to process email document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
