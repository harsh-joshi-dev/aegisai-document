/**
 * AI Analysis Engine – Aegis AI Decision Workspace
 * Optional OpenAI-backed analysis. Falls back to no signals when API unavailable.
 */

import type { RiskSignal } from './types';

const BACKEND_AI_RISK_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/risk/analyze-ai`
  : '';

export interface DocumentForAI {
  id: string;
  tenantId: string;
  name?: string;
  docType?: string;
  amount?: number;
  vendor?: string;
  gst?: string;
  date?: string;
  summary?: string;
  /** Plain text extracted from document (for AI) */
  textContent?: string;
}

/**
 * Call backend to analyze document with AI. Returns signals or [] on error/disabled.
 */
export async function analyzeDocumentWithAI(doc: DocumentForAI): Promise<RiskSignal[]> {
  if (!BACKEND_AI_RISK_URL) return [];

  const text = doc.textContent || [
    doc.name,
    doc.docType,
    doc.amount != null ? `Amount: ${doc.amount}` : '',
    doc.vendor ? `Vendor: ${doc.vendor}` : '',
    doc.gst ? `GST: ${doc.gst}` : '',
    doc.date ? `Date: ${doc.date}` : '',
    doc.summary || '',
  ]
    .filter(Boolean)
    .join('\n');

  if (!text.trim()) return [];

  try {
    const res = await fetch(BACKEND_AI_RISK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: doc.id,
        tenantId: doc.tenantId,
        text,
        metadata: { docType: doc.docType, amount: doc.amount, vendor: doc.vendor },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const signals = Array.isArray(data.signals) ? data.signals : [];
    return signals.map((s: Record<string, unknown>) => ({
      id: (s.id as string) || `ai-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      documentId: doc.id,
      tenantId: doc.tenantId,
      type: 'AI' as const,
      subtype: (s.subtype as string) || 'ai_analysis',
      severity: ((s.severity as string) || 'MEDIUM').toUpperCase() as RiskSignal['severity'],
      confidence: typeof s.confidenceScore === 'number' ? s.confidenceScore : 70,
      weight: (s.weight as number) || 30,
      explanation: (s.description as string) || 'AI analysis finding',
      recommendation: {
        action: (s.suggestedAction as RiskSignal['suggestedAction']) || 'verify',
        reason: (s.recommendation as string) || 'Review document.',
        priority: (s.priority as number) || 3
      },
      impact: (s.impact as RiskSignal['impact']) || 'financial',
      evidence: Array.isArray(s.evidence) ? s.evidence as string[] : ['AI analysis'],
      suggestedAction: (s.suggestedAction as RiskSignal['suggestedAction']) || 'verify',
      metadata: {
        evidence: Array.isArray(s.evidence) ? s.evidence as string[] : ['ai_analysis'],
        fields: Array.isArray(s.fields) ? s.fields as string[] : [],
        documentIds: [doc.id]
      },
      createdAt: (s.createdAt as string) || new Date().toISOString(),
      title: (s.title as string) || 'AI finding',
      description: (s.description as string) || '',
      confidenceScore: typeof s.confidenceScore === 'number' ? s.confidenceScore : 70,
    }));
  } catch {
    return [];
  }
}
