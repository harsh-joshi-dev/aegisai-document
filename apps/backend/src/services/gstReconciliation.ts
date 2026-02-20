/**
 * GSTR-2A/2B Reconciliation Service
 * Cross-references purchase invoices against GST return data
 * to identify mismatches that block input tax credit (ITC).
 */

import { pool } from '../db/pgvector.js';

export interface GstInvoiceRecord {
  documentId: string;
  filename: string;
  vendorGstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  taxableAmount: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  totalGst: number | null;
  totalAmount: number | null;
  documentType: string;
}

export interface ReconciliationMismatch {
  type: 'missing_in_gstr' | 'missing_in_books' | 'amount_mismatch' | 'gstin_mismatch' | 'date_mismatch' | 'invoice_number_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  invoiceDocumentId: string | null;
  gstrDocumentId: string | null;
  vendorGstin: string | null;
  invoiceNumber: string | null;
  field: string;
  bookValue: string | number | null;
  gstrValue: string | number | null;
  description: string;
  itcImpact: number | null;
}

export interface ReconciliationResult {
  tenantId: string;
  period: { from: string; to: string } | null;
  totalInvoices: number;
  totalGstrRecords: number;
  matched: number;
  mismatched: number;
  missingInGstr: number;
  missingInBooks: number;
  mismatches: ReconciliationMismatch[];
  summary: {
    totalTaxableAmount: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGst: number;
    itcAtRisk: number;
    reconciliationScore: number;
  };
  recommendations: string[];
}

function parseGstDocsFromDb(rows: any[]): GstInvoiceRecord[] {
  return rows.map(row => {
    const ed = typeof row.extracted_data === 'string'
      ? JSON.parse(row.extracted_data)
      : row.extracted_data || {};
    const cgst = ed.cgstAmount || 0;
    const sgst = ed.sgstAmount || 0;
    const igst = ed.igstAmount || 0;
    return {
      documentId: row.id,
      filename: row.filename,
      vendorGstin: ed.vendorGstin || null,
      invoiceNumber: ed.invoiceNumber || null,
      invoiceDate: ed.invoiceDate || null,
      taxableAmount: ed.taxableAmount || null,
      cgstAmount: cgst || null,
      sgstAmount: sgst || null,
      igstAmount: igst || null,
      totalGst: (cgst + sgst + igst) || null,
      totalAmount: ed.totalAmount || null,
      documentType: ed.documentType || 'UNKNOWN',
    };
  });
}

export async function reconcileGstr(
  tenantId: string,
  options?: { from?: string; to?: string }
): Promise<ReconciliationResult> {
  // Get all invoices (purchase invoices / tax invoices)
  let invoiceQuery = `
    SELECT id, filename, extracted_data, uploaded_at
    FROM documents
    WHERE tenant_id = $1
      AND (extracted_data->>'documentType' = 'INVOICE'
           OR LOWER(filename) LIKE '%invoice%'
           OR LOWER(filename) LIKE '%tax%invoice%')
  `;
  const invoiceParams: any[] = [tenantId];
  let paramIdx = 2;

  if (options?.from) {
    invoiceQuery += ` AND uploaded_at >= $${paramIdx}`;
    invoiceParams.push(options.from);
    paramIdx++;
  }
  if (options?.to) {
    invoiceQuery += ` AND uploaded_at <= $${paramIdx}`;
    invoiceParams.push(options.to);
    paramIdx++;
  }
  invoiceQuery += ` ORDER BY uploaded_at DESC LIMIT 500`;

  // Get all GST return documents (GSTR filings)
  let gstrQuery = `
    SELECT id, filename, extracted_data, uploaded_at
    FROM documents
    WHERE tenant_id = $1
      AND (extracted_data->>'documentType' = 'GST'
           OR LOWER(filename) LIKE '%gstr%'
           OR LOWER(filename) LIKE '%gst%return%'
           OR LOWER(filename) LIKE '%2a%'
           OR LOWER(filename) LIKE '%2b%')
  `;
  const gstrParams: any[] = [tenantId];
  let gstrParamIdx = 2;

  if (options?.from) {
    gstrQuery += ` AND uploaded_at >= $${gstrParamIdx}`;
    gstrParams.push(options.from);
    gstrParamIdx++;
  }
  if (options?.to) {
    gstrQuery += ` AND uploaded_at <= $${gstrParamIdx}`;
    gstrParams.push(options.to);
    gstrParamIdx++;
  }
  gstrQuery += ` ORDER BY uploaded_at DESC LIMIT 500`;

  const [invoiceResult, gstrResult] = await Promise.all([
    pool.query(invoiceQuery, invoiceParams),
    pool.query(gstrQuery, gstrParams),
  ]);

  const invoices = parseGstDocsFromDb(invoiceResult.rows);
  const gstrRecords = parseGstDocsFromDb(gstrResult.rows);

  const mismatches: ReconciliationMismatch[] = [];
  let matched = 0;

  // Build lookup maps for GSTR records by vendor GSTIN + invoice number
  const gstrByKey = new Map<string, GstInvoiceRecord>();
  const gstrByGstin = new Map<string, GstInvoiceRecord[]>();
  for (const rec of gstrRecords) {
    if (rec.vendorGstin && rec.invoiceNumber) {
      gstrByKey.set(`${rec.vendorGstin}::${rec.invoiceNumber.toUpperCase()}`, rec);
    }
    if (rec.vendorGstin) {
      if (!gstrByGstin.has(rec.vendorGstin)) gstrByGstin.set(rec.vendorGstin, []);
      gstrByGstin.get(rec.vendorGstin)!.push(rec);
    }
  }

  const matchedGstrIds = new Set<string>();

  for (const inv of invoices) {
    if (!inv.vendorGstin) continue;

    const key = inv.invoiceNumber
      ? `${inv.vendorGstin}::${inv.invoiceNumber.toUpperCase()}`
      : null;
    const gstrMatch = key ? gstrByKey.get(key) : undefined;

    if (!gstrMatch) {
      // Check if there's any GSTR record for this GSTIN
      const gstinRecords = gstrByGstin.get(inv.vendorGstin);
      if (!gstinRecords || gstinRecords.length === 0) {
        mismatches.push({
          type: 'missing_in_gstr',
          severity: 'high',
          invoiceDocumentId: inv.documentId,
          gstrDocumentId: null,
          vendorGstin: inv.vendorGstin,
          invoiceNumber: inv.invoiceNumber,
          field: 'invoice',
          bookValue: inv.totalAmount,
          gstrValue: null,
          description: `Invoice ${inv.invoiceNumber || inv.filename} from ${inv.vendorGstin} not found in any GSTR-2A/2B filing. ITC claim at risk.`,
          itcImpact: inv.totalGst || 0,
        });
      }
      continue;
    }

    matchedGstrIds.add(gstrMatch.documentId);

    // Compare amounts
    const tolerance = 1; // ₹1 tolerance

    if (inv.totalGst && gstrMatch.totalGst && Math.abs(inv.totalGst - gstrMatch.totalGst) > tolerance) {
      mismatches.push({
        type: 'amount_mismatch',
        severity: 'medium',
        invoiceDocumentId: inv.documentId,
        gstrDocumentId: gstrMatch.documentId,
        vendorGstin: inv.vendorGstin,
        invoiceNumber: inv.invoiceNumber,
        field: 'totalGst',
        bookValue: inv.totalGst,
        gstrValue: gstrMatch.totalGst,
        description: `GST amount mismatch for invoice ${inv.invoiceNumber || ''} from ${inv.vendorGstin}: books show ₹${inv.totalGst.toLocaleString('en-IN')} but GSTR shows ₹${gstrMatch.totalGst.toLocaleString('en-IN')}.`,
        itcImpact: Math.abs(inv.totalGst - gstrMatch.totalGst),
      });
    } else {
      matched++;
    }

    if (inv.taxableAmount && gstrMatch.taxableAmount && Math.abs(inv.taxableAmount - gstrMatch.taxableAmount) > tolerance) {
      mismatches.push({
        type: 'amount_mismatch',
        severity: 'medium',
        invoiceDocumentId: inv.documentId,
        gstrDocumentId: gstrMatch.documentId,
        vendorGstin: inv.vendorGstin,
        invoiceNumber: inv.invoiceNumber,
        field: 'taxableAmount',
        bookValue: inv.taxableAmount,
        gstrValue: gstrMatch.taxableAmount,
        description: `Taxable amount mismatch: books show ₹${inv.taxableAmount.toLocaleString('en-IN')} but GSTR shows ₹${gstrMatch.taxableAmount.toLocaleString('en-IN')}.`,
        itcImpact: null,
      });
    }
  }

  // Find GSTR records not matched to any invoice (missing in books)
  for (const rec of gstrRecords) {
    if (!matchedGstrIds.has(rec.documentId) && rec.vendorGstin) {
      mismatches.push({
        type: 'missing_in_books',
        severity: 'medium',
        invoiceDocumentId: null,
        gstrDocumentId: rec.documentId,
        vendorGstin: rec.vendorGstin,
        invoiceNumber: rec.invoiceNumber,
        field: 'invoice',
        bookValue: null,
        gstrValue: rec.totalAmount,
        description: `GSTR-2A/2B entry from ${rec.vendorGstin} (Invoice: ${rec.invoiceNumber || 'N/A'}) has no corresponding purchase invoice in your books.`,
        itcImpact: null,
      });
    }
  }

  // Calculate totals
  const totalTaxable = invoices.reduce((s, i) => s + (i.taxableAmount || 0), 0);
  const totalCgst = invoices.reduce((s, i) => s + (i.cgstAmount || 0), 0);
  const totalSgst = invoices.reduce((s, i) => s + (i.sgstAmount || 0), 0);
  const totalIgst = invoices.reduce((s, i) => s + (i.igstAmount || 0), 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const itcAtRisk = mismatches.reduce((s, m) => s + (m.itcImpact || 0), 0);
  const totalDocs = invoices.length + gstrRecords.length;
  const reconciliationScore = totalDocs > 0
    ? Math.max(0, Math.round(100 - (mismatches.length / Math.max(totalDocs, 1)) * 100))
    : 100;

  const recommendations: string[] = [];
  const missingInGstr = mismatches.filter(m => m.type === 'missing_in_gstr').length;
  const missingInBooks = mismatches.filter(m => m.type === 'missing_in_books').length;

  if (missingInGstr > 0) {
    recommendations.push(`${missingInGstr} invoice(s) are missing from GSTR-2A/2B. Follow up with vendors to file their returns before claiming ITC.`);
  }
  if (missingInBooks > 0) {
    recommendations.push(`${missingInBooks} GSTR entry/entries have no matching purchase invoice. Obtain copies or update your purchase register.`);
  }
  if (itcAtRisk > 0) {
    recommendations.push(`₹${itcAtRisk.toLocaleString('en-IN')} of Input Tax Credit is at risk due to reconciliation gaps. Resolve before filing GSTR-3B.`);
  }
  if (mismatches.length === 0) {
    recommendations.push('All invoices reconcile with GSTR-2A/2B records. ITC claims are clean.');
  }

  return {
    tenantId,
    period: options?.from && options?.to ? { from: options.from, to: options.to } : null,
    totalInvoices: invoices.length,
    totalGstrRecords: gstrRecords.length,
    matched,
    mismatched: mismatches.filter(m => m.type === 'amount_mismatch').length,
    missingInGstr,
    missingInBooks,
    mismatches,
    summary: {
      totalTaxableAmount: totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      itcAtRisk,
      reconciliationScore,
    },
    recommendations,
  };
}
