/**
 * Cross-Document Matching Engine – Aegis AI Decision Workspace
 * Links and compares documents (Invoice, Bank, GST) to detect mismatches.
 */

import type { RiskSignal } from './types';

export interface DocumentForMatch {
  id: string;
  tenantId: string;
  docType?: string;
  amount?: number;
  vendor?: string;
  gst?: string;
  date?: string;
  [key: string]: unknown;
}

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return `sig-cross-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Compare linked documents and emit mismatch signals.
 * Expected: invoice, bank, gst (any can be undefined).
 */
export function compareDocuments(
  documents: DocumentForMatch[],
  tenantId: string,
  primaryDocId: string
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const invoice = documents.find((d) => (d.docType || '').toString().toLowerCase() === 'invoice');
  const bank = documents.find((d) => (d.docType || '').toString().toLowerCase() === 'bank');
  const gst = documents.find((d) => (d.docType || '').toString().toLowerCase() === 'gst');

  if (!invoice && !bank && !gst) return signals;

  const amounts = [invoice?.amount, bank?.amount, gst?.amount].filter((a): a is number => typeof a === 'number' && a > 0);
  if (amounts.length >= 2) {
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (max - min > 1) {
      const evidenceDocs = documents.filter(d => d.amount && amounts.includes(d.amount)).map(d => d.id);
      signals.push({
        id: id(),
        documentId: primaryDocId,
        tenantId,
        type: 'PATTERN',
        subtype: 'amount_mismatch',
        severity: 'HIGH',
        confidence: 90,
        weight: 50,
        explanation: `Amount mismatch across documents: min ₹${min.toLocaleString('en-IN')}, max ₹${max.toLocaleString('en-IN')}`,
        recommendation: {
          action: 'hold',
          reason: 'Reconcile amounts across linked documents before approval',
          priority: 1
        },
        impact: 'financial',
        evidence: [`Invoice: ₹${invoice?.amount?.toLocaleString('en-IN') || 'N/A'}`, `Bank: ₹${bank?.amount?.toLocaleString('en-IN') || 'N/A'}`, `GST: ₹${gst?.amount?.toLocaleString('en-IN') || 'N/A'}`],
        suggestedAction: 'hold',
        metadata: {
          evidence: [`amount_mismatch_${min}_${max}`],
          fields: ['Amount'],
          documentIds: evidenceDocs
        },
        createdAt: now(),
        field: 'Amount',
        sourceA: `₹${min.toLocaleString('en-IN')}`,
        sourceB: `₹${max.toLocaleString('en-IN')}`,
        title: 'Amount mismatch across documents',
        description: `Invoice/Bank/GST amounts differ: min ₹${min.toLocaleString('en-IN')}, max ₹${max.toLocaleString('en-IN')}`,
        confidenceScore: 90,
      });
    }
  }

  if (invoice && bank && invoice.amount != null && bank.amount != null) {
    if (Math.abs((invoice.amount ?? 0) - (bank.amount ?? 0)) > 1) {
      signals.push({
        id: id(),
        documentId: primaryDocId,
        tenantId,
        type: 'PATTERN',
        subtype: 'invoice_bank_amount_mismatch',
        severity: 'HIGH',
        confidence: 95,
        weight: 50,
        explanation: `Invoice amount ₹${(invoice.amount ?? 0).toLocaleString('en-IN')} does not match bank record ₹${(bank.amount ?? 0).toLocaleString('en-IN')}`,
        recommendation: {
          action: 'verify',
          reason: 'Verify payment against invoice before approval',
          priority: 1
        },
        impact: 'financial',
        evidence: [`Invoice: ₹${(invoice.amount ?? 0).toLocaleString('en-IN')}`, `Bank: ₹${(bank.amount ?? 0).toLocaleString('en-IN')}`],
        suggestedAction: 'verify',
        metadata: {
          evidence: [`invoice_bank_mismatch_${invoice.amount}_${bank.amount}`],
          fields: ['Amount'],
          documentIds: [invoice.id, bank.id]
        },
        createdAt: now(),
        field: 'Amount',
        sourceA: `Invoice: ₹${(invoice.amount ?? 0).toLocaleString('en-IN')}`,
        sourceB: `Bank: ₹${(bank.amount ?? 0).toLocaleString('en-IN')}`,
        title: 'Invoice vs Bank amount mismatch',
        description: `Invoice amount ₹${(invoice.amount ?? 0).toLocaleString('en-IN')} does not match bank record ₹${(bank.amount ?? 0).toLocaleString('en-IN')}`,
        confidenceScore: 95,
      });
    }
  }

  if (invoice && gst && invoice.vendor && gst.vendor && invoice.vendor !== gst.vendor) {
    signals.push({
      id: id(),
      documentId: primaryDocId,
      tenantId,
      type: 'PATTERN',
      subtype: 'vendor_mismatch',
      severity: 'MEDIUM',
      confidence: 85,
      weight: 25,
      explanation: `Invoice vendor "${invoice.vendor}" differs from GST vendor "${gst.vendor}"`,
      recommendation: {
        action: 'verify',
        reason: 'Verify vendor identity across documents',
        priority: 2
      },
      impact: 'compliance',
      evidence: [`Invoice vendor: ${invoice.vendor}`, `GST vendor: ${gst.vendor}`],
      suggestedAction: 'verify',
      metadata: {
        evidence: [`vendor_mismatch_${invoice.vendor}_${gst.vendor}`],
        fields: ['Vendor'],
        documentIds: [invoice.id, gst.id]
      },
      createdAt: now(),
      field: 'Vendor',
      sourceA: invoice.vendor,
      sourceB: gst.vendor,
      title: 'Vendor mismatch (Invoice vs GST)',
      description: `Invoice vendor "${invoice.vendor}" differs from GST vendor "${gst.vendor}"`,
      confidenceScore: 85,
    });
  }

  if (invoice && gst && invoice.gst && gst.gst && invoice.gst !== gst.gst) {
    signals.push({
      id: id(),
      documentId: primaryDocId,
      tenantId,
      type: 'PATTERN',
      subtype: 'gstin_mismatch',
      severity: 'HIGH',
      confidence: 95,
      weight: 50,
      explanation: `Invoice GSTIN "${invoice.gst}" does not match GST document "${gst.gst}"`,
      recommendation: {
        action: 'reject',
        reason: 'Verify GSTIN across linked documents',
        priority: 1
      },
      impact: 'compliance',
      evidence: [`Invoice GSTIN: ${invoice.gst}`, `GST document GSTIN: ${gst.gst}`],
      suggestedAction: 'reject',
      metadata: {
        evidence: [`gstin_mismatch_${invoice.gst}_${gst.gst}`],
        fields: ['GST'],
        documentIds: [invoice.id, gst.id]
      },
      createdAt: now(),
      field: 'GST',
      sourceA: invoice.gst,
      sourceB: gst.gst,
      title: 'GSTIN mismatch across documents',
      description: `Invoice GSTIN "${invoice.gst}" does not match GST document "${gst.gst}"`,
      confidenceScore: 95,
    });
  }

  return signals;
}
