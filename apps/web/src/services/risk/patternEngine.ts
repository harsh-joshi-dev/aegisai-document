/**
 * Pattern Detection Engine – Aegis AI Decision Workspace
 * Detects patterns across documents: duplicates, anomalies, suspicious activity.
 */

import type { RiskSignal } from './types';

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return `sig-pattern-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export interface DocumentForPatterns {
  id: string;
  tenantId?: string;
  amount?: number;
  vendor?: string;
  name?: string;
  date?: string;
  [key: string]: unknown;
}

/**
 * Generate vendor folder organization signals for better UX.
 * Detects when documents need to be organized into vendor-specific folders.
 */
export function generateVendorFolderSignals(
  doc: DocumentForPatterns,
  allTenantDocs: DocumentForPatterns[],
  tenantId: string,
  existingFolders?: string[]
): RiskSignal[] {
  const signals: RiskSignal[] = [];
  
  if (!doc.vendor) {
    return signals;
  }

  // Check if vendor folder exists
  const vendorFolderName = `Vendor - ${doc.vendor}`;
  const folderExists = existingFolders?.includes(vendorFolderName);
  
  if (!folderExists) {
    // Count documents for this vendor
    const vendorDocs = allTenantDocs.filter(d => d.vendor === doc.vendor);
    
    if (vendorDocs.length >= 2) {
      signals.push({
        id: id(),
        documentId: doc.id,
        tenantId,
        type: 'PATTERN',
        subtype: 'vendor_folder_needed',
        severity: 'MEDIUM',
        confidence: 90,
        weight: 25,
        explanation: `${vendorDocs.length} documents from vendor "${doc.vendor}" detected. Consider creating a dedicated vendor folder for better organization.`,
        recommendation: {
          action: 'approve',
          reason: `Create folder "${vendorFolderName}" to organize ${vendorDocs.length} vendor documents`,
          priority: 2
        },
        impact: 'compliance',
        evidence: [`Vendor: ${doc.vendor}`, `Documents: ${vendorDocs.length}`, `Total amount: ₹${vendorDocs.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString('en-IN')}`],
        suggestedAction: 'approve',
        metadata: {
          evidence: [`vendor_folder_${doc.vendor}`],
          fields: ['Vendor', 'Amount'],
          documentIds: vendorDocs.map(d => d.id)
        },
        createdAt: now(),
        title: 'Vendor folder organization recommended',
        description: `Multiple documents from ${doc.vendor} can be better organized in a dedicated folder.`,
        confidenceScore: 90,
      });
    }
  }

  return signals;
}

/**
 * Generate pattern-based risk signals for a document given all tenant documents.
 */
export function generatePatternSignals(
  doc: DocumentForPatterns,
  allTenantDocs: DocumentForPatterns[],
  tenantId: string
): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const others = allTenantDocs.filter((d) => d.id !== doc.id);

  // Duplicate amount across multiple vendors (suspicious)
  const sameAmount = others.filter((d) => d.amount === doc.amount && doc.amount && doc.amount > 0);
  if (sameAmount.length >= 2 && doc.amount && doc.amount > 50000) {
    const relatedDocIds = [doc.id, ...sameAmount.map(d => d.id)];
    signals.push({
      id: id(),
      documentId: doc.id,
      tenantId,
      type: 'PATTERN',
      subtype: 'duplicate_amount',
      severity: 'HIGH',
      confidence: 75,
      weight: 50,
      explanation: `Amount ₹${(doc.amount || 0).toLocaleString('en-IN')} appears in ${sameAmount.length + 1} documents across different vendors.`,
      recommendation: {
        action: 'verify',
        reason: 'Verify these are distinct transactions. Duplicate amounts may indicate copy-paste errors or fraud.',
        priority: 1
      },
      impact: 'fraud',
      evidence: [`Amount: ₹${(doc.amount || 0).toLocaleString('en-IN')}`, `Found in ${sameAmount.length + 1} documents`],
      suggestedAction: 'verify',
      metadata: {
        evidence: [`duplicate_amount_${doc.amount}`],
        fields: ['Amount'],
        documentIds: relatedDocIds
      },
      createdAt: now(),
      title: 'Duplicate amount across vendors',
      description: `Amount ₹${(doc.amount || 0).toLocaleString('en-IN')} appears in ${sameAmount.length + 1} documents across different vendors.`,
      confidenceScore: 75,
    });
  }

  // Rapid increase in invoice amount for same vendor
  const sameVendor = others.filter((d) => d.vendor && d.vendor === doc.vendor);
  if (sameVendor.length >= 2 && doc.amount) {
    const amounts = sameVendor.map((d) => d.amount ?? 0).filter(Boolean);
    const maxOther = Math.max(...amounts, 0);
    if (doc.amount > maxOther * 2 && doc.amount > 50000) {
      const relatedDocIds = [doc.id, ...sameVendor.map(d => d.id)];
      signals.push({
        id: id(),
        documentId: doc.id,
        tenantId,
        type: 'PATTERN',
        subtype: 'rapid_amount_increase',
        severity: 'MEDIUM',
        confidence: 70,
        weight: 25,
        explanation: `Invoice amount ₹${doc.amount.toLocaleString('en-IN')} is more than 2x the previous max from ${doc.vendor}.`,
        recommendation: {
          action: 'hold',
          reason: 'Confirm vendor pricing and obtain approval for the increase.',
          priority: 2
        },
        impact: 'financial',
        evidence: [`Current amount: ₹${doc.amount.toLocaleString('en-IN')}`, `Previous max: ₹${maxOther.toLocaleString('en-IN')}`, `Vendor: ${doc.vendor}`],
        suggestedAction: 'hold',
        metadata: {
          evidence: [`amount_increase_${doc.vendor}_${doc.amount}`],
          fields: ['Amount', 'Vendor'],
          documentIds: relatedDocIds
        },
        createdAt: now(),
        title: 'Rapid amount increase',
        description: `Invoice amount ₹${doc.amount.toLocaleString('en-IN')} is more than 2x the previous max from ${doc.vendor}.`,
        confidenceScore: 70,
      });
    }
  }

  // High-value invoice (>1L) without prior history from vendor
  if (doc.amount && doc.amount > 100000 && sameVendor.length === 0) {
    signals.push({
      id: id(),
      documentId: doc.id,
      tenantId,
      type: 'PATTERN',
      subtype: 'first_high_value_vendor',
      severity: 'MEDIUM',
      confidence: 65,
      weight: 25,
      explanation: `First invoice from ${doc.vendor} exceeds ₹1,00,000. No prior transaction history.`,
      recommendation: {
        action: 'verify',
        reason: 'Verify vendor credentials and consider additional due diligence.',
        priority: 2
      },
      impact: 'financial',
      evidence: [`Amount: ₹${doc.amount.toLocaleString('en-IN')}`, `New vendor: ${doc.vendor}`, 'No prior transaction history'],
      suggestedAction: 'verify',
      metadata: {
        evidence: [`first_high_value_${doc.vendor}_${doc.amount}`],
        fields: ['Amount', 'Vendor'],
        documentIds: [doc.id]
      },
      createdAt: now(),
      title: 'First high-value transaction with vendor',
      description: `First invoice from ${doc.vendor} exceeds ₹1,00,000. No prior transaction history.`,
      confidenceScore: 65,
    });
  }

  return signals;
}
