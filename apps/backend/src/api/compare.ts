import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parsePDF } from '../services/pdfParser.js';
import { classifyDocumentRisk } from '../services/classifier.js';
import { insertDocument, getDocument } from '../db/pgvector.js';
import { z } from 'zod';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Compare two documents (v1 and v2)
router.post('/', upload.fields([
  { name: 'v1', maxCount: 1 },
  { name: 'v2', maxCount: 1 },
  { name: 'documentId', maxCount: 1 }, // Optional: if comparing with existing document
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.v1 || !files.v1[0] || !files.v2 || !files.v2[0]) {
      return res.status(400).json({ error: 'Both v1 and v2 PDF files are required' });
    }

    const v1File = files.v1[0];
    const v2File = files.v2[0];
    const documentId = req.body.documentId; // Optional existing document ID

    // Parse both PDFs
    const v1Parsed = await parsePDF(v1File.buffer);
    const v2Parsed = await parsePDF(v2File.buffer);

    // Classify both documents
    const v1Risk = await classifyDocumentRisk(v1Parsed.text);
    const v2Risk = await classifyDocumentRisk(v2Parsed.text);

    // Simple text diffing (for production, use a proper diff library)
    const v1Lines = v1Parsed.text.split('\n').filter(line => line.trim().length > 0);
    const v2Lines = v2Parsed.text.split('\n').filter(line => line.trim().length > 0);
    
    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{ old: string; new: string }> = [];

    // Simple comparison (for production, use proper diff algorithm)
    const v1Set = new Set(v1Lines);
    const v2Set = new Set(v2Lines);

    v2Lines.forEach(line => {
      if (!v1Set.has(line)) {
        added.push(line);
      }
    });

    v1Lines.forEach(line => {
      if (!v2Set.has(line)) {
        removed.push(line);
      }
    });

    // Analyze new risks in v2
    const newRisks: string[] = [];
    if (v2Risk.riskLevel === 'Critical' && v1Risk.riskLevel !== 'Critical') {
      newRisks.push('Critical risk level introduced in v2');
    }
    if (v2Risk.riskCategory !== v1Risk.riskCategory && v2Risk.riskCategory !== 'None') {
      newRisks.push(`New risk category: ${v2Risk.riskCategory}`);
    }

    // Insert v2 as new document with version tracking
    const parentDocId = documentId || null;
    const v2Document = await insertDocument(
      v2File.originalname,
      {
        numPages: v2Parsed.numPages,
        ...v2Parsed.metadata,
        isVersion: true,
        parentVersion: v1File.originalname,
      },
      v2Risk.riskCategory,
      v2Risk.confidence,
      2, // version number
      parentDocId
    );

    res.json({
      success: true,
      comparison: {
        v1: {
          filename: v1File.originalname,
          riskLevel: v1Risk.riskLevel,
          riskCategory: v1Risk.riskCategory,
          riskConfidence: Math.round(v1Risk.confidence * 100),
          numPages: v1Parsed.numPages,
        },
        v2: {
          id: v2Document.id,
          filename: v2File.originalname,
          riskLevel: v2Risk.riskLevel,
          riskCategory: v2Risk.riskCategory,
          riskConfidence: Math.round(v2Risk.confidence * 100),
          numPages: v2Parsed.numPages,
        },
        changes: {
          addedLines: added.length,
          removedLines: removed.length,
          modifiedLines: modified.length,
          added: added.slice(0, 10), // Limit to first 10 for response
          removed: removed.slice(0, 10),
          modified: modified.slice(0, 10),
        },
        newRisks,
        riskChange: {
          levelChanged: v2Risk.riskLevel !== v1Risk.riskLevel,
          categoryChanged: v2Risk.riskCategory !== v1Risk.riskCategory,
          confidenceChange: Math.round((v2Risk.confidence - v1Risk.confidence) * 100),
        },
      },
    });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({
      error: 'Failed to compare documents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
