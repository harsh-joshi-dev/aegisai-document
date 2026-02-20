/**
 * Vendor Intelligence API
 * Vendor 360° profiles, predictive risk forecasting,
 * risk trend graphs, and fraud/default/escalation probability.
 */

import express, { Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { requireWorkspaceContext, requireWorkspaceRole, type WorkspaceRequest } from '../workspace/middleware.js';
import { pool } from '../db/pgvector.js';

const router = express.Router();

// ============================================================================
// Vendor 360° Profile
// ============================================================================

router.get(
  '/:vendorKey',
  requireAuth,
  requireWorkspaceContext,
  requireWorkspaceRole(['owner', 'admin', 'reviewer', 'viewer']),
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    const tenantId = authReq.workspace!.tenantId;
    const { vendorKey } = req.params;

    try {
      // Vendor memory (statistical baseline)
      const memResult = await pool.query(
        `SELECT vendor_name, vendor_gstin, count, mean_amount, m2_amount, last_amount, last_seen_at, created_at
         FROM vendor_memory WHERE tenant_id = $1 AND vendor_key = $2`,
        [tenantId, vendorKey]
      );
      const memory = memResult.rows[0] || null;

      // All documents for this vendor
      const docsResult = await pool.query(
        `SELECT id, filename, uploaded_at, risk_level, risk_score, extracted_data, summary
         FROM documents
         WHERE tenant_id = $1 AND (
           extracted_data->>'vendorKey' = $2
           OR extracted_data->>'vendor_gstin' = $2
           OR extracted_data->>'vendorGstin' = $2
           OR vendor_name = $2
         )
         ORDER BY uploaded_at DESC LIMIT 200`,
        [tenantId, vendorKey]
      );
      const documents = docsResult.rows;

      // Pattern events for this vendor
      const patternsResult = await pool.query(
        `SELECT event_type, severity, title, details, created_at
         FROM pattern_events
         WHERE tenant_id = $1 AND vendor_key = $2
         ORDER BY created_at DESC LIMIT 50`,
        [tenantId, vendorKey]
      );
      const patternEvents = patternsResult.rows;

      // Risk signals for vendor's documents
      const docIds = documents.map((d: any) => d.id);
      let riskSignals: any[] = [];
      if (docIds.length > 0) {
        const sigResult = await pool.query(
          `SELECT document_id, type, subtype, severity, confidence, explanation, created_at
           FROM risk_signals
           WHERE tenant_id = $1 AND document_id = ANY($2::uuid[])
           ORDER BY created_at DESC LIMIT 100`,
          [tenantId, docIds]
        );
        riskSignals = sigResult.rows;
      }

      // Build monthly risk trend
      const monthlyTrend = buildMonthlyTrend(documents);

      // Financial aggregates
      const financials = buildFinancialAggregates(documents);

      // Predictive risk scores
      const predictions = computePredictions(memory, documents, patternEvents, riskSignals);

      // Risk heatmap (by month and category)
      const heatmap = buildRiskHeatmap(riskSignals, documents);

      const vendorName = memory?.vendor_name
        || documents[0]?.extracted_data?.vendorName
        || documents[0]?.extracted_data?.vendor
        || vendorKey;

      res.json({
        success: true,
        vendor: {
          key: vendorKey,
          name: vendorName,
          gstin: memory?.vendor_gstin || documents[0]?.extracted_data?.vendorGstin || null,
          firstTransaction: documents.length ? documents[documents.length - 1].uploaded_at : null,
          lastTransaction: documents.length ? documents[0].uploaded_at : null,
          totalDocuments: documents.length,
          stats: memory ? {
            count: memory.count,
            meanAmount: parseFloat(memory.mean_amount) || 0,
            variance: memory.count > 1
              ? parseFloat(memory.m2_amount) / (memory.count - 1)
              : 0,
            stdDev: memory.count > 1
              ? Math.sqrt(parseFloat(memory.m2_amount) / (memory.count - 1))
              : 0,
            lastAmount: parseFloat(memory.last_amount) || 0,
          } : null,
        },
        financials,
        monthlyTrend,
        predictions,
        heatmap,
        recentDocuments: documents.slice(0, 10).map((d: any) => ({
          id: d.id,
          filename: d.filename,
          uploadedAt: d.uploaded_at,
          riskLevel: d.risk_level,
          riskScore: d.risk_score,
          amount: d.extracted_data?.totalAmount || d.extracted_data?.amount || null,
        })),
        patternHistory: patternEvents.slice(0, 20).map((p: any) => ({
          eventType: p.event_type,
          severity: p.severity,
          title: p.title,
          details: p.details,
          createdAt: p.created_at,
        })),
        riskSignalSummary: {
          total: riskSignals.length,
          critical: riskSignals.filter((s: any) => s.severity === 'critical').length,
          high: riskSignals.filter((s: any) => s.severity === 'high').length,
          medium: riskSignals.filter((s: any) => s.severity === 'medium').length,
          low: riskSignals.filter((s: any) => s.severity === 'low').length,
        },
      });
    } catch (error) {
      console.error('Vendor intelligence error:', error);
      res.status(500).json({
        error: 'Failed to get vendor intelligence',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ============================================================================
// Vendor List (for directory/search)
// ============================================================================

router.get(
  '/',
  requireAuth,
  requireWorkspaceContext,
  async (req: Request, res: Response) => {
    const authReq = req as WorkspaceRequest;
    const tenantId = authReq.workspace!.tenantId;

    try {
      const result = await pool.query(
        `SELECT vendor_key, vendor_name, vendor_gstin, count, mean_amount, last_amount, last_seen_at
         FROM vendor_memory WHERE tenant_id = $1
         ORDER BY last_seen_at DESC NULLS LAST LIMIT 100`,
        [tenantId]
      );

      const vendors = result.rows.map((r: any) => ({
        key: r.vendor_key,
        name: r.vendor_name,
        gstin: r.vendor_gstin,
        documentCount: r.count,
        avgAmount: parseFloat(r.mean_amount) || 0,
        lastAmount: parseFloat(r.last_amount) || 0,
        lastSeen: r.last_seen_at,
      }));

      res.json({ success: true, vendors, count: vendors.length });
    } catch (error) {
      console.error('Vendor list error:', error);
      res.status(500).json({ error: 'Failed to list vendors' });
    }
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

function buildMonthlyTrend(documents: any[]): Array<{
  month: string;
  docCount: number;
  totalAmount: number;
  avgRiskScore: number;
  highRiskCount: number;
}> {
  const months = new Map<string, { count: number; totalAmount: number; riskScores: number[]; highRisk: number }>();

  for (const doc of documents) {
    const d = new Date(doc.uploaded_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) months.set(key, { count: 0, totalAmount: 0, riskScores: [], highRisk: 0 });
    const m = months.get(key)!;
    m.count++;
    const amt = doc.extracted_data?.totalAmount || doc.extracted_data?.amount || 0;
    m.totalAmount += typeof amt === 'number' ? amt : parseFloat(amt) || 0;
    if (doc.risk_score != null) m.riskScores.push(doc.risk_score);
    if (doc.risk_level === 'high' || doc.risk_level === 'critical') m.highRisk++;
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, data]) => ({
      month,
      docCount: data.count,
      totalAmount: Math.round(data.totalAmount),
      avgRiskScore: data.riskScores.length
        ? Math.round(data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length)
        : 0,
      highRiskCount: data.highRisk,
    }));
}

function buildFinancialAggregates(documents: any[]) {
  let totalInvoiceValue = 0;
  let totalGst = 0;
  let invoiceCount = 0;

  for (const doc of documents) {
    const ed = doc.extracted_data || {};
    const amt = parseFloat(ed.totalAmount || ed.amount || 0) || 0;
    totalInvoiceValue += amt;
    totalGst += (parseFloat(ed.cgstAmount || 0) || 0)
      + (parseFloat(ed.sgstAmount || 0) || 0)
      + (parseFloat(ed.igstAmount || 0) || 0);
    if (ed.documentType === 'INVOICE') invoiceCount++;
  }

  return {
    totalInvoiceValue: Math.round(totalInvoiceValue),
    totalGst: Math.round(totalGst),
    invoiceCount,
    avgInvoiceValue: invoiceCount > 0 ? Math.round(totalInvoiceValue / invoiceCount) : 0,
  };
}

function computePredictions(
  memory: any,
  documents: any[],
  patternEvents: any[],
  riskSignals: any[]
): {
  fraudProbability: number;
  paymentDefaultRisk: number;
  escalationRisk: number;
  overallRiskTrajectory: 'improving' | 'stable' | 'deteriorating';
  confidence: number;
  factors: string[];
} {
  let fraudScore = 0;
  let defaultScore = 0;
  let escalationScore = 0;
  const factors: string[] = [];

  // Factor 1: Pattern events — anomaly history
  const anomalyCount = patternEvents.filter((p: any) =>
    p.event_type === 'VENDOR_AMOUNT_SPIKE' || p.severity === 'HIGH' || p.severity === 'CRITICAL'
  ).length;
  if (anomalyCount >= 5) {
    fraudScore += 25;
    escalationScore += 20;
    factors.push(`${anomalyCount} anomalous pattern events in history`);
  } else if (anomalyCount >= 2) {
    fraudScore += 10;
    escalationScore += 10;
    factors.push(`${anomalyCount} anomaly events detected`);
  }

  // Factor 2: Amount variance — high variance = unpredictable vendor
  if (memory && memory.count > 3) {
    const variance = parseFloat(memory.m2_amount) / (memory.count - 1);
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / (parseFloat(memory.mean_amount) || 1);
    if (cv > 1.5) {
      fraudScore += 20;
      defaultScore += 15;
      factors.push(`High payment variance (CV: ${cv.toFixed(2)}) suggests erratic billing`);
    } else if (cv > 0.8) {
      fraudScore += 8;
      defaultScore += 5;
      factors.push(`Moderate payment variance (CV: ${cv.toFixed(2)})`);
    }
  }

  // Factor 3: Risk signal density
  const criticalSignals = riskSignals.filter((s: any) => s.severity === 'critical').length;
  const highSignals = riskSignals.filter((s: any) => s.severity === 'high').length;
  if (criticalSignals >= 3) {
    fraudScore += 30;
    escalationScore += 25;
    factors.push(`${criticalSignals} critical risk signals across documents`);
  }
  if (highSignals >= 5) {
    fraudScore += 15;
    escalationScore += 15;
    factors.push(`${highSignals} high-severity risk signals`);
  }

  // Factor 4: Circular payment or rapid transactions
  const circularPayments = riskSignals.filter((s: any) => s.subtype === 'circular_payment').length;
  if (circularPayments > 0) {
    fraudScore += 40;
    factors.push('Circular payment patterns detected — strong fraud indicator');
  }
  const rapidTxn = riskSignals.filter((s: any) => s.subtype === 'rapid_transactions').length;
  if (rapidTxn > 0) {
    fraudScore += 10;
    factors.push('Rapid transaction patterns detected');
  }

  // Factor 5: Risk trajectory — compare recent 3 months avg vs prior 3 months
  const recentDocs = documents.filter((d: any) => {
    const ago = Date.now() - new Date(d.uploaded_at).getTime();
    return ago < 90 * 24 * 60 * 60 * 1000;
  });
  const olderDocs = documents.filter((d: any) => {
    const ago = Date.now() - new Date(d.uploaded_at).getTime();
    return ago >= 90 * 24 * 60 * 60 * 1000 && ago < 180 * 24 * 60 * 60 * 1000;
  });

  const recentAvgRisk = recentDocs.length > 0
    ? recentDocs.reduce((s: number, d: any) => s + (d.risk_score || 0), 0) / recentDocs.length
    : 0;
  const olderAvgRisk = olderDocs.length > 0
    ? olderDocs.reduce((s: number, d: any) => s + (d.risk_score || 0), 0) / olderDocs.length
    : 0;

  let trajectory: 'improving' | 'stable' | 'deteriorating' = 'stable';
  if (recentDocs.length >= 2 && olderDocs.length >= 2) {
    const delta = recentAvgRisk - olderAvgRisk;
    if (delta > 15) {
      trajectory = 'deteriorating';
      escalationScore += 20;
      defaultScore += 15;
      factors.push(`Risk trending upward: recent avg ${recentAvgRisk.toFixed(0)} vs prior ${olderAvgRisk.toFixed(0)}`);
    } else if (delta < -15) {
      trajectory = 'improving';
      factors.push(`Risk improving: recent avg ${recentAvgRisk.toFixed(0)} vs prior ${olderAvgRisk.toFixed(0)}`);
    }
  }

  // Factor 6: Missing documents / compliance gaps
  const missingGst = documents.filter((d: any) => {
    const ed = d.extracted_data || {};
    return ed.documentType === 'INVOICE' && !ed.vendorGstin;
  }).length;
  if (missingGst >= 3) {
    defaultScore += 15;
    factors.push(`${missingGst} invoices missing GSTIN — compliance risk`);
  }

  const confidence = Math.min(0.95, 0.3 + (documents.length / 50) * 0.4 + (patternEvents.length / 20) * 0.25);

  return {
    fraudProbability: Math.min(100, Math.max(0, Math.round(fraudScore))),
    paymentDefaultRisk: Math.min(100, Math.max(0, Math.round(defaultScore))),
    escalationRisk: Math.min(100, Math.max(0, Math.round(escalationScore))),
    overallRiskTrajectory: trajectory,
    confidence: parseFloat(confidence.toFixed(2)),
    factors,
  };
}

function buildRiskHeatmap(riskSignals: any[], documents: any[]): Array<{
  month: string;
  rule: number;
  pattern: number;
  anomaly: number;
}> {
  const months = new Map<string, { rule: number; pattern: number; anomaly: number }>();

  for (const sig of riskSignals) {
    const d = new Date(sig.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) months.set(key, { rule: 0, pattern: 0, anomaly: 0 });
    const m = months.get(key)!;
    if (sig.type === 'rule_violation') m.rule++;
    else if (sig.type === 'pattern') m.pattern++;
    else m.anomaly++;
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, data]) => ({ month, ...data }));
}

export default router;
