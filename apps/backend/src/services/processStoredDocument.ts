import { parseDocument, isSupportedFileType } from './documentParser.js';
import { chunkText } from './chunker.js';
import { generateEmbeddings } from './embeddings.js';
import { classifyDocumentRisk } from './classifier.js';
import { classifyDocumentType, getFinancialYearFromDate } from './documentTypeClassifier.js';
import { extractFinancialData } from './financialExtraction.js';
import { generateFinancialSummary } from './financialSummary.js';
import { computeRiskScore } from './financialRiskScore.js';
import {
  getDocumentForProcessingByTenant,
  insertChunks,
  updateDocumentFinancialFieldsByTenant,
  updateDocumentMetadataByTenant,
  updateDocumentProcessingByTenant,
  updateDocumentRiskLevelByTenant,
  replaceRiskSignalsForDocument,
  upsertRiskResult,
  type RiskRecommendation,
  getOrCreateFolderByTenant,
  setDocumentFolderByTenant,
  pool,
} from '../db/pgvector.js';
import { computeAndPersistInsights } from './insightsEngine.js';

export async function processStoredDocument(params: { tenantId: string; documentId: string; actorUserId: string }): Promise<void> {
  const { tenantId, documentId, actorUserId } = params;

  const recommendationsFromSignals = (signals: Array<{ recommendation: RiskRecommendation }>): RiskRecommendation[] => {
    const seen = new Set<string>();
    const out: RiskRecommendation[] = [];
    for (const s of signals) {
      const key = `${s.recommendation.action_type}:${s.recommendation.priority}:${s.recommendation.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s.recommendation);
    }
    return out;
  };

  const riskLevelFromScore = (score: number): 'Safe' | 'Review Required' | 'High Risk' | 'Critical' => {
    if (score <= 30) return 'Safe';
    if (score <= 60) return 'Review Required';
    if (score <= 80) return 'High Risk';
    return 'Critical';
  };

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 1, error: null });

  const doc = await getDocumentForProcessingByTenant({ documentId, tenantId });
  if (!doc) {
    await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'FAILED', progress: 100, error: 'Document not found or access denied' });
    return;
  }

  if (!doc.fileData || doc.fileData.length === 0) {
    await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'FAILED', progress: 100, error: 'Stored file data missing' });
    return;
  }

  const mimetype = doc.fileType || 'application/pdf';
  if (!isSupportedFileType(mimetype, doc.filename)) {
    await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'FAILED', progress: 100, error: `Unsupported file type: ${mimetype}` });
    return;
  }

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 8, error: null });

  const parsed = await parseDocument(doc.fileData, mimetype, doc.filename);
  if (!parsed.text || parsed.text.trim().length === 0) {
    await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'FAILED', progress: 100, error: 'No extractable text found in document' });
    return;
  }

  const textForAnalysis = parsed.text;

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 15, error: null });

  const riskAnalysis = await classifyDocumentRisk(textForAnalysis).catch(() => ({
    riskLevel: 'Normal' as const,
    riskCategory: 'None' as const,
    confidence: 0.5,
    explanation: 'Classification service unavailable. Document processed with default risk level.',
    recommendations: ['Review document manually', 'Verify content is appropriate'],
  }));

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 22, error: null });

  // Financial extraction + summary + risk score (best-effort)
  let extractedForRisk: Record<string, unknown> | null = null;
  let computedScore: number | null = null;
  try {
    const extracted = extractFinancialData({ text: textForAnalysis, filename: doc.filename });
    extractedForRisk = extracted as unknown as Record<string, unknown>;
    const summary = await generateFinancialSummary({ extracted, text: textForAnalysis, filename: doc.filename });
    const riskScore = computeRiskScore({ extracted, classification: riskAnalysis as any });
    computedScore = riskScore.score;

    await updateDocumentFinancialFieldsByTenant({
      documentId,
      tenantId,
      extractedData: extracted as unknown as Record<string, unknown>,
      riskScore: riskScore.score,
      summary,
    });

    await updateDocumentMetadataByTenant(documentId, tenantId, {
      financial: {
        extracted,
        riskHighlights: riskScore.highlights,
      },
    });
  } catch {
    // ignore
  }

  await updateDocumentRiskLevelByTenant({
    documentId,
    tenantId,
    riskLevel: (riskAnalysis as any).riskLevel,
    riskCategory: (riskAnalysis as any).riskCategory || 'None',
    riskConfidence: (riskAnalysis as any).confidence || 0.5,
  });

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 40, error: null });

  // If this is a retry, remove any existing chunks first to avoid duplication
  await pool.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);

  const chunks = chunkText(textForAnalysis, { chunkSize: 1000, chunkOverlap: 200 });
  const validChunks = chunks.filter((c) => {
    const content = (c.content || '').trim();
    return content.length > 0 && content.length <= 8000;
  });

  if (validChunks.length === 0) {
    await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'FAILED', progress: 100, error: 'No valid chunks found in document' });
    return;
  }

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 55, error: null });

  const embeddings = await generateEmbeddings(validChunks.map((c) => c.content));

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 75, error: null });

  await insertChunks(
    documentId,
    validChunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: embeddings[index] || [],
      metadata: chunk.metadata,
    }))
  );

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'PROCESSING', progress: 88, error: null });

  // Auto smart folder classification
  try {
    const typeResult = await classifyDocumentType(textForAnalysis, doc.filename);
    const baseDate = doc.uploadedAt ?? new Date();
    const financialYear = typeResult.financialYear ?? getFinancialYearFromDate(new Date(baseDate));
    await updateDocumentMetadataByTenant(documentId, tenantId, {
      documentType: typeResult.documentType,
      financialYear,
    });
    const folderId = await getOrCreateFolderByTenant({ tenantId, actorUserId, folderName: typeResult.folderName });
    if (folderId) {
      await setDocumentFolderByTenant({ documentId, tenantId, folderId });
    }
  } catch {
    // ignore
  }

  await updateDocumentProcessingByTenant({ documentId, tenantId, status: 'COMPLETED', progress: 100, error: null });

  try {
    await computeAndPersistInsights({ tenantId, actorUserId, documentId });
  } catch {
    // ignore
  }

  // Persist unified RiskSignals + RiskResult (MVP: missing fields + existing extraction score)
  try {
    const extracted = extractedForRisk || {};
    const missing: string[] = [];
    const vendorGstin = (extracted as any)?.vendorGstin as string | undefined;
    const invoiceNumber = (extracted as any)?.invoiceNumber as string | undefined;
    const invoiceDate = (extracted as any)?.invoiceDate as string | undefined;
    const totalAmount = (extracted as any)?.totalAmount as number | undefined;
    const amount = (extracted as any)?.amount as number | undefined;

    if (!vendorGstin) missing.push('vendorGstin');
    if (!invoiceNumber) missing.push('invoiceNumber');
    if (!invoiceDate) missing.push('invoiceDate');
    if (totalAmount == null && amount == null) missing.push('amount');

    const signals: Array<{
      type: 'mismatch' | 'rule_violation' | 'pattern' | 'missing_field';
      severity: 'low' | 'medium' | 'high' | 'critical';
      confidence: number;
      weight: number;
      explanation: string;
      recommendation: RiskRecommendation;
      metadata?: Record<string, unknown> | null;
    }> = [];

    for (const field of missing) {
      signals.push({
        type: 'missing_field',
        severity: field === 'amount' ? 'high' : 'medium',
        confidence: 0.95,
        weight: field === 'amount' ? 1.3 : 1,
        explanation: `Missing required field: ${field}`,
        recommendation: {
          action_type: 'request',
          message: `Request/verify the missing field: ${field}.`,
          priority: field === 'amount' ? 'high' : 'medium',
        },
        metadata: { field },
      });
    }

    if ((riskAnalysis as any)?.riskLevel === 'Critical') {
      signals.push({
        type: 'pattern',
        severity: 'critical',
        confidence: typeof (riskAnalysis as any).confidence === 'number' ? (riskAnalysis as any).confidence : 0.6,
        weight: 1.8,
        explanation: (riskAnalysis as any).explanation || 'High-risk classification',
        recommendation: {
          action_type: 'escalate',
          message: 'Escalate for review due to critical risk classification.',
          priority: 'high',
        },
        metadata: { source: 'classifier', category: (riskAnalysis as any).riskCategory || null },
      });
    } else if ((riskAnalysis as any)?.riskLevel === 'Warning') {
      signals.push({
        type: 'pattern',
        severity: 'high',
        confidence: typeof (riskAnalysis as any).confidence === 'number' ? (riskAnalysis as any).confidence : 0.6,
        weight: 1.2,
        explanation: (riskAnalysis as any).explanation || 'Risk classification indicates warning',
        recommendation: {
          action_type: 'verify',
          message: 'Verify document details due to elevated risk classification.',
          priority: 'high',
        },
        metadata: { source: 'classifier', category: (riskAnalysis as any).riskCategory || null },
      });
    }

    const score = typeof computedScore === 'number' ? computedScore : 0;
    const riskLevel = riskLevelFromScore(score);
    const recommendations = recommendationsFromSignals(signals);
    await replaceRiskSignalsForDocument({ tenantId, documentId, signals });
    await upsertRiskResult({
      tenantId,
      documentId,
      riskScore: score,
      riskLevel,
      factors: {
        signalCount: signals.length,
        missingFields: missing,
        classification: {
          riskLevel: (riskAnalysis as any).riskLevel,
          riskCategory: (riskAnalysis as any).riskCategory,
          confidence: (riskAnalysis as any).confidence,
        },
      },
      summary:
        riskLevel === 'Safe'
          ? 'No major issues detected.'
          : `Detected ${signals.length} issue(s) requiring attention.`,
      recommendations,
    });
  } catch {
    // ignore
  }
}
