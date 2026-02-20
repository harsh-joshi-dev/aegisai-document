import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { pool } from '../db/pgvector.js';
import crypto from 'crypto';

// ============================================================
// Document Templates
// ============================================================

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  requiredDocuments: RequiredDocument[];
}

export interface RequiredDocument {
  type: string;
  label: string;
  mandatory: boolean;
  requiresAnalysis?: boolean;
  description?: string;
}

export const DOCUMENT_TEMPLATES: Record<string, DocumentTemplate> = {
  contractor: {
    id: 'contractor',
    name: 'Contractor',
    description: 'Documents required for contractor onboarding and compliance verification',
    requiredDocuments: [
      { type: 'pan_card', label: 'PAN Card', mandatory: true, requiresAnalysis: false, description: 'Permanent Account Number card' },
      { type: 'gst_certificate', label: 'GST Certificate', mandatory: true, requiresAnalysis: false, description: 'GST registration certificate' },
      { type: 'invoice', label: 'Invoice', mandatory: true, requiresAnalysis: true, description: 'Service/work invoice' },
      { type: 'agreement', label: 'Agreement / Contract', mandatory: true, requiresAnalysis: true, description: 'Signed work agreement or contract' },
      { type: 'bank_details', label: 'Bank Account Details', mandatory: true, requiresAnalysis: false, description: 'Cancelled cheque or bank statement' },
      { type: 'tds_certificate', label: 'TDS Certificate', mandatory: false, requiresAnalysis: true, description: 'Form 16A or TDS certificate' },
      { type: 'address_proof', label: 'Address Proof', mandatory: false, requiresAnalysis: false, description: 'Utility bill or address document' },
    ],
  },
  vendor: {
    id: 'vendor',
    name: 'Vendor',
    description: 'Documents required for vendor registration and procurement compliance',
    requiredDocuments: [
      { type: 'pan_card', label: 'PAN Card', mandatory: true, requiresAnalysis: false, description: 'Permanent Account Number card' },
      { type: 'gst_certificate', label: 'GST Certificate', mandatory: true, requiresAnalysis: false, description: 'GST registration certificate' },
      { type: 'tax_invoice', label: 'Tax Invoice', mandatory: true, requiresAnalysis: true, description: 'Tax invoice for goods/services' },
      { type: 'purchase_order', label: 'Purchase Order', mandatory: true, requiresAnalysis: true, description: 'PO document' },
      { type: 'delivery_challan', label: 'Delivery Challan', mandatory: false, requiresAnalysis: false, description: 'Proof of delivery' },
      { type: 'bank_details', label: 'Bank Account Details', mandatory: true, requiresAnalysis: false, description: 'Cancelled cheque or bank statement' },
      { type: 'msme_certificate', label: 'MSME Certificate', mandatory: false, requiresAnalysis: false, description: 'MSME/Udyam registration' },
      { type: 'credit_note', label: 'Credit Note / Debit Note', mandatory: false, requiresAnalysis: true, description: 'If applicable' },
    ],
  },
  employee: {
    id: 'employee',
    name: 'Employee',
    description: 'Documents required for employee onboarding and HR compliance',
    requiredDocuments: [
      { type: 'pan_card', label: 'PAN Card', mandatory: true, requiresAnalysis: false, description: 'Permanent Account Number card' },
      { type: 'aadhar_card', label: 'Aadhar Card', mandatory: true, requiresAnalysis: false, description: 'Aadhar identification' },
      { type: 'bank_details', label: 'Bank Account Details', mandatory: true, requiresAnalysis: false, description: 'Cancelled cheque or passbook' },
      { type: 'address_proof', label: 'Address Proof', mandatory: true, requiresAnalysis: false, description: 'Utility bill, rent agreement, etc.' },
      { type: 'photo_id', label: 'Photo ID', mandatory: true, requiresAnalysis: false, description: 'Passport, Voter ID, or Driving License' },
      { type: 'education_cert', label: 'Education Certificate', mandatory: false, requiresAnalysis: false, description: 'Degree or diploma certificate' },
      { type: 'experience_letter', label: 'Experience Letter', mandatory: false, requiresAnalysis: false, description: 'From previous employer' },
      { type: 'offer_letter', label: 'Offer / Joining Letter', mandatory: false, requiresAnalysis: false, description: 'Signed offer letter' },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Custom document requirements',
    requiredDocuments: [],
  },
};

// ============================================================
// Issue Types
// ============================================================

export type IssueCategory = 'missing' | 'mismatch' | 'format_error' | 'fraud' | 'warning' | 'suggestion';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface VendorIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  affectedDocuments: string[];
  affectedDocumentNames: string[];
  recommendation: string;
  autoDetected: boolean;
  riskPoints: number;
}

export interface VendorAnalysisResult {
  overallRiskScore: number;
  overallRiskLevel: 'Safe' | 'Warning' | 'Critical';
  totalDocuments: number;
  issuesCount: number;
  issues: VendorIssue[];
  missingDocuments: Array<{ type: string; label: string; mandatory: boolean }>;
  uploadedDocumentTypes: Array<{ type: string; label: string; documentId: string; filename: string }>;
  progress: {
    total: number;
    uploaded: number;
    mandatory: number;
    mandatoryUploaded: number;
    percentage: number;
    status: 'pending' | 'partial' | 'complete';
  };
  summary: string;
  vendorHealthScore: number;
  categories: Record<IssueCategory, number>;
  duplicates: Array<{ documentIds: string[]; filenames: string[]; reason: string }>;
  formatErrors: Array<{ field: string; value: string; expected: string; documentId: string }>;
  crossDocMismatches: Array<{ field: string; values: Record<string, string>; description: string }>;
}

// ============================================================
// Format Validation
// ============================================================

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUM_REGEX = /^\d{9,18}$/;
const AADHAR_REGEX = /^\d{4}\s?\d{4}\s?\d{4}$/;

interface FormatError {
  field: string;
  value: string;
  expected: string;
  documentId: string;
  filename: string;
}

function validateFormats(documents: any[], chunksByDoc: Record<string, string[]>): FormatError[] {
  const errors: FormatError[] = [];

  for (const doc of documents) {
    const extracted = typeof doc.extracted_data === 'string'
      ? JSON.parse(doc.extracted_data) : (doc.extracted_data || {});
    const allText = (chunksByDoc[doc.id] || []).join(' ');

    // PAN validation
    const panMatch = allText.match(/[A-Z]{5}[0-9]{4}[A-Z]/g);
    if (panMatch) {
      for (const pan of panMatch) {
        if (!PAN_REGEX.test(pan)) {
          errors.push({ field: 'PAN', value: pan, expected: 'ABCDE1234F format', documentId: doc.id, filename: doc.filename });
        }
      }
    }
    if (extracted.pan && !PAN_REGEX.test(extracted.pan)) {
      errors.push({ field: 'PAN', value: extracted.pan, expected: 'ABCDE1234F format', documentId: doc.id, filename: doc.filename });
    }

    // GST validation
    const gstMatch = allText.match(/\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d/g);
    if (gstMatch) {
      for (const gst of gstMatch) {
        if (!GST_REGEX.test(gst)) {
          errors.push({ field: 'GSTIN', value: gst, expected: '22AAAAA0000A1Z5 format (15 chars)', documentId: doc.id, filename: doc.filename });
        }
      }
    }
    if (extracted.gstin && !GST_REGEX.test(extracted.gstin)) {
      errors.push({ field: 'GSTIN', value: extracted.gstin, expected: '22AAAAA0000A1Z5 format', documentId: doc.id, filename: doc.filename });
    }

    // Account number
    if (extracted.accountNumber) {
      const cleaned = String(extracted.accountNumber).replace(/\s/g, '');
      if (!ACCOUNT_NUM_REGEX.test(cleaned)) {
        errors.push({ field: 'Account Number', value: extracted.accountNumber, expected: '9-18 digits', documentId: doc.id, filename: doc.filename });
      }
    }

    // IFSC
    if (extracted.ifsc && !IFSC_REGEX.test(extracted.ifsc)) {
      errors.push({ field: 'IFSC', value: extracted.ifsc, expected: 'ABCD0123456 format', documentId: doc.id, filename: doc.filename });
    }
  }

  return errors;
}

// ============================================================
// Duplicate Detection
// ============================================================

interface DuplicateGroup {
  documentIds: string[];
  filenames: string[];
  reason: string;
}

function detectDuplicates(documents: any[], chunksByDoc: Record<string, string[]>): DuplicateGroup[] {
  const duplicates: DuplicateGroup[] = [];

  // Method 1: File hash comparison (if we have file data)
  const contentHashes: Record<string, { id: string; filename: string }[]> = {};
  for (const doc of documents) {
    const chunks = chunksByDoc[doc.id] || [];
    if (chunks.length > 0) {
      const hash = crypto.createHash('md5').update(chunks.join('')).digest('hex');
      if (!contentHashes[hash]) contentHashes[hash] = [];
      contentHashes[hash].push({ id: doc.id, filename: doc.filename });
    }
  }
  for (const [, docs] of Object.entries(contentHashes)) {
    if (docs.length > 1) {
      duplicates.push({
        documentIds: docs.map(d => d.id),
        filenames: docs.map(d => d.filename),
        reason: 'Identical document content detected',
      });
    }
  }

  // Method 2: Invoice number duplication
  const invoiceNumbers: Record<string, { id: string; filename: string }[]> = {};
  for (const doc of documents) {
    const extracted = typeof doc.extracted_data === 'string'
      ? JSON.parse(doc.extracted_data) : (doc.extracted_data || {});
    if (extracted.invoiceNumber) {
      const key = String(extracted.invoiceNumber).trim().toLowerCase();
      if (!invoiceNumbers[key]) invoiceNumbers[key] = [];
      invoiceNumbers[key].push({ id: doc.id, filename: doc.filename });
    }
  }
  for (const [invNo, docs] of Object.entries(invoiceNumbers)) {
    if (docs.length > 1) {
      duplicates.push({
        documentIds: docs.map(d => d.id),
        filenames: docs.map(d => d.filename),
        reason: `Duplicate invoice number: ${invNo}`,
      });
    }
  }

  // Method 3: Filename similarity
  const nameGroups: Record<string, { id: string; filename: string }[]> = {};
  for (const doc of documents) {
    const normalizedName = doc.filename.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!nameGroups[normalizedName]) nameGroups[normalizedName] = [];
    nameGroups[normalizedName].push({ id: doc.id, filename: doc.filename });
  }
  for (const [, docs] of Object.entries(nameGroups)) {
    if (docs.length > 1) {
      const alreadyCaught = duplicates.some(d =>
        d.documentIds.some(id => docs.some(dd => dd.id === id))
      );
      if (!alreadyCaught) {
        duplicates.push({
          documentIds: docs.map(d => d.id),
          filenames: docs.map(d => d.filename),
          reason: 'Similar filenames — possible duplicate upload',
        });
      }
    }
  }

  return duplicates;
}

// ============================================================
// Cross-Document Mismatch Detection
// ============================================================

interface CrossDocMismatch {
  field: string;
  values: Record<string, string>;
  description: string;
}

function detectCrossDocMismatches(documents: any[]): CrossDocMismatch[] {
  const mismatches: CrossDocMismatch[] = [];

  const fieldCollections: Record<string, Record<string, string>> = {
    vendorName: {},
    pan: {},
    gstin: {},
    bankName: {},
    accountNumber: {},
    ifsc: {},
    totalAmount: {},
  };

  for (const doc of documents) {
    const extracted = typeof doc.extracted_data === 'string'
      ? JSON.parse(doc.extracted_data) : (doc.extracted_data || {});

    if (extracted.vendorName) fieldCollections.vendorName[doc.filename] = extracted.vendorName;
    if (extracted.pan) fieldCollections.pan[doc.filename] = extracted.pan;
    if (extracted.gstin) fieldCollections.gstin[doc.filename] = extracted.gstin;
    if (extracted.bankName) fieldCollections.bankName[doc.filename] = extracted.bankName;
    if (extracted.accountNumber) fieldCollections.accountNumber[doc.filename] = String(extracted.accountNumber);
    if (extracted.ifsc) fieldCollections.ifsc[doc.filename] = extracted.ifsc;
    if (doc.vendor_name) fieldCollections.vendorName[doc.filename] = fieldCollections.vendorName[doc.filename] || doc.vendor_name;
  }

  // Check PAN name vs vendor name consistency
  const panNames = Object.values(fieldCollections.pan);
  const vendorNames = Object.values(fieldCollections.vendorName);
  if (panNames.length > 0 && vendorNames.length > 0) {
    const uniquePANs = [...new Set(panNames.map(p => p.toUpperCase()))];
    if (uniquePANs.length > 1) {
      mismatches.push({
        field: 'PAN Number',
        values: fieldCollections.pan,
        description: `Multiple PAN numbers detected across documents: ${uniquePANs.join(', ')}. All documents should have the same PAN.`,
      });
    }
  }

  // Check GST consistency
  const gstValues = Object.values(fieldCollections.gstin);
  if (gstValues.length > 1) {
    const uniqueGST = [...new Set(gstValues.map(g => g.toUpperCase()))];
    if (uniqueGST.length > 1) {
      mismatches.push({
        field: 'GSTIN',
        values: fieldCollections.gstin,
        description: `Multiple GSTIN numbers found: ${uniqueGST.join(', ')}. Verify if the vendor has multiple GST registrations.`,
      });
    }
  }

  // PAN vs GST cross-check (PAN is embedded in GST: positions 2-11)
  if (panNames.length > 0 && gstValues.length > 0) {
    const pan = panNames[0].toUpperCase();
    for (const gst of gstValues) {
      const panInGST = gst.substring(2, 12).toUpperCase();
      if (panInGST !== pan && pan.length === 10) {
        mismatches.push({
          field: 'PAN vs GSTIN',
          values: { PAN: pan, 'PAN in GSTIN': panInGST, GSTIN: gst },
          description: `PAN (${pan}) does not match the PAN embedded in GSTIN (${panInGST}). This is a serious discrepancy.`,
        });
      }
    }
  }

  // Bank details consistency
  const bankNames = Object.values(fieldCollections.bankName);
  if (bankNames.length > 1) {
    const uniqueBanks = [...new Set(bankNames.map(b => b.toLowerCase().trim()))];
    if (uniqueBanks.length > 1) {
      mismatches.push({
        field: 'Bank Name',
        values: fieldCollections.bankName,
        description: `Multiple bank names found: ${uniqueBanks.join(', ')}. Verify the correct bank account.`,
      });
    }
  }

  // Vendor name consistency
  if (vendorNames.length > 1) {
    const uniqueNames = [...new Set(vendorNames.map(n => n.toLowerCase().trim()))];
    if (uniqueNames.length > 1) {
      mismatches.push({
        field: 'Vendor Name',
        values: fieldCollections.vendorName,
        description: `Inconsistent vendor names across documents: ${uniqueNames.join(', ')}`,
      });
    }
  }

  return mismatches;
}

// ============================================================
// Document Type Classification (match to template)
// ============================================================

function extractAIDocumentType(summary: string): string {
  // AI summaries start with "- Document Type: Income Tax Return Acknowledgement..."
  // or "Document Type: Bank Statement for ..."
  const m = summary.match(/document\s+type\s*:\s*([^.\-–]+)/i);
  if (m) return m[1].trim().toLowerCase();
  return '';
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyDocumentToTemplate(
  doc: any,
  chunksByDoc: Record<string, string[]>,
  template: DocumentTemplate
): { type: string; label: string } | null {
  const extracted = typeof doc.extracted_data === 'string'
    ? JSON.parse(doc.extracted_data) : (doc.extracted_data || {});
  const meta = typeof doc.metadata === 'string'
    ? JSON.parse(doc.metadata) : (doc.metadata || {});
  const filename = normalizeForMatch(doc.filename || '');
  const summary = (doc.summary || '').toLowerCase();
  const text = (chunksByDoc[doc.id] || []).join(' ').toLowerCase().slice(0, 3000);

  // PRIMARY: Extract what the AI identified the document as
  const aiDocType = extractAIDocumentType(doc.summary || '');
  const extractedDocType = normalizeForMatch(
    (extracted.documentType || meta.documentType || '').replace(/_/g, ' ')
  );

  // Synonym map: maps known AI document type phrases to canonical required doc type slugs
  const synonyms: Record<string, string[]> = {
    pan_card: ['pan card', 'pan', 'permanent account number'],
    pan_card_company: ['pan card', 'pan', 'company pan', 'permanent account number'],
    gst_certificate: ['gst registration certificate', 'gst certificate', 'gst registration', 'goods and services tax'],
    gst_registration_certificate: ['gst registration certificate', 'gst certificate', 'gst registration', 'goods and services tax'],
    invoice: ['invoice', 'tax invoice', 'bill', 'billing statement'],
    tax_invoice: ['tax invoice', 'gst invoice', 'invoice'],
    agreement: ['agreement', 'contract', 'memorandum of understanding'],
    bank_details: ['bank statement', 'bank account', 'cancelled cheque', 'passbook'],
    bank_statement: ['bank statement', 'bank statement summary', 'account statement'],
    bank_statement_summary: ['bank statement', 'bank statement summary', 'account statement'],
    cancelled_cheque: ['cancelled cheque', 'canceled cheque', 'cheque'],
    tds_certificate: ['tds certificate', 'tds', 'tax deducted at source', 'form 16', 'form 26as'],
    address_proof: ['address proof', 'utility bill', 'electricity bill', 'rent agreement'],
    purchase_order: ['purchase order'],
    delivery_challan: ['delivery challan', 'challan'],
    msme_certificate: ['msme certificate', 'udyam registration', 'msme'],
    credit_note: ['credit note', 'debit note'],
    aadhar_card: ['aadhar card', 'aadhaar', 'aadhar'],
    photo_id: ['passport', 'voter id', 'driving license'],
    education_cert: ['degree certificate', 'diploma', 'education certificate'],
    experience_letter: ['experience letter', 'relieving letter'],
    offer_letter: ['offer letter', 'joining letter', 'appointment letter'],
    vendor_kyc: ['vendor kyc', 'kyc form', 'kyc', 'vendor registration', 'know your customer'],
    itr: ['income tax return', 'itr', 'itr acknowledgement', 'income tax return acknowledgement'],
    profit_loss_account: ['profit loss', 'profit and loss', 'profit & loss', 'p&l account', 'income and expenditure'],
    audit_balancesheet: ['audited balance sheet', 'balance sheet', 'audited balance', 'audit balance sheet'],
    balance_sheet: ['balance sheet', 'audited balance sheet', 'audited balance'],
    independent_auditors: ['independent auditor', 'auditors report', 'auditor report', 'independent auditors report', 'statutory auditor'],
    certificate_of_incorporation: ['certificate of incorporation', 'incorporation certificate'],
  };

  let bestMatch: { type: string; label: string; score: number } | null = null;

  for (const reqDoc of template.requiredDocuments) {
    let score = 0;

    const syns = synonyms[reqDoc.type] || [];
    const reqLabel = normalizeForMatch(reqDoc.label);
    const reqSlug = reqDoc.type.replace(/_/g, ' ');
    // All phrases to check: synonyms + label + slug
    const matchPhrases = [...new Set([...syns, reqLabel, reqSlug])];

    // ===== PHASE 1: Match against AI-identified document type (highest weight) =====
    if (aiDocType) {
      for (const phrase of matchPhrases) {
        // Check if the AI doc type contains the phrase or vice versa
        if (aiDocType.includes(phrase) || phrase.includes(aiDocType)) {
          score += 50;
          break;
        }
      }
      // Token overlap between AI doc type and match phrases
      if (score === 0) {
        const aiTokens: string[] = aiDocType.split(/\s+/).filter((t: string) => t.length > 2);
        const reqTokens: string[] = reqSlug.split(/\s+/).filter((t: string) => t.length > 2);
        const labelToks: string[] = reqLabel.split(/\s+/).filter((t: string) => t.length > 2);
        const allReqTokens = [...new Set([...reqTokens, ...labelToks])];

        let matched = 0;
        for (const at of aiTokens) {
          if (allReqTokens.some((rt: string) => rt.includes(at) || at.includes(rt))) matched++;
        }
        if (allReqTokens.length > 0 && matched > 0) {
          const ratio = matched / Math.max(aiTokens.length, allReqTokens.length);
          if (ratio >= 0.4) score += Math.round(ratio * 40);
        }
      }
    }

    // ===== PHASE 2: Match against extracted_data.documentType =====
    if (extractedDocType && score < 30) {
      for (const phrase of matchPhrases) {
        if (extractedDocType.includes(phrase) || phrase.includes(extractedDocType)) {
          score += 30;
          break;
        }
      }
    }

    // ===== PHASE 3: Filename matching =====
    for (const phrase of matchPhrases) {
      if (filename.includes(phrase)) { score += 20; break; }
    }
    // Token matching: slug tokens vs filename tokens
    const reqTokens: string[] = reqDoc.type.split('_').filter((t: string) => t.length > 2);
    const fnTokens: string[] = filename.split(/\s+/).filter((t: string) => t.length > 2);
    let fnTokenMatches = 0;
    for (const rt of reqTokens) {
      if (fnTokens.some((ft: string) => ft.includes(rt) || rt.includes(ft))) fnTokenMatches++;
    }
    if (reqTokens.length > 0 && fnTokenMatches >= Math.ceil(reqTokens.length * 0.5)) {
      score += fnTokenMatches * 3;
    }

    // ===== PHASE 4: Summary text matching (lower weight) =====
    for (const phrase of matchPhrases) {
      if (summary.includes(phrase)) { score += 10; break; }
    }

    // ===== PHASE 5: Document text matching (lowest weight) =====
    for (const phrase of matchPhrases) {
      if (text.includes(phrase)) { score += 5; break; }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { type: reqDoc.type, label: reqDoc.label, score };
    }
  }

  if (bestMatch && bestMatch.score >= 8) {
    return { type: bestMatch.type, label: bestMatch.label };
  }

  return null;
}

// ============================================================
// Main Analysis Function
// ============================================================

export async function analyzeVendorDocuments(params: {
  tenantId: string;
  folderId: string;
  vendorName: string;
  template?: string;
  requiredDocuments?: RequiredDocument[];
}): Promise<VendorAnalysisResult> {
  const { tenantId, folderId, vendorName, template: templateId, requiredDocuments: customDocs } = params;

  const templateDef = templateId && DOCUMENT_TEMPLATES[templateId]
    ? DOCUMENT_TEMPLATES[templateId]
    : DOCUMENT_TEMPLATES.vendor;

  const requiredDocs = customDocs && customDocs.length > 0
    ? customDocs
    : templateDef.requiredDocuments;

  const docsResult = await pool.query(
    `SELECT d.id, d.filename, d.risk_level, d.risk_category, d.risk_score,
            d.extracted_data, d.summary, d.metadata, d.vendor_name, d.uploaded_at, d.file_type
     FROM documents d
     WHERE d.tenant_id = $1 AND d.folder_id = $2
     ORDER BY d.uploaded_at DESC`,
    [tenantId, folderId]
  );

  const documents = docsResult.rows as any[];

  const chunksResult = await pool.query(
    `SELECT dc.document_id, dc.content
     FROM document_chunks dc
     JOIN documents d ON dc.document_id = d.id
     WHERE d.tenant_id = $1 AND d.folder_id = $2
     ORDER BY dc.chunk_index ASC`,
    [tenantId, folderId]
  );

  const chunksByDoc: Record<string, string[]> = {};
  for (const row of chunksResult.rows as any[]) {
    if (!chunksByDoc[row.document_id]) chunksByDoc[row.document_id] = [];
    chunksByDoc[row.document_id].push(row.content);
  }

  // Classify uploaded docs against template
  const uploadedDocTypes: Array<{ type: string; label: string; documentId: string; filename: string }> = [];
  const matchedTypes = new Set<string>();

  for (const doc of documents) {
    const classified = classifyDocumentToTemplate(doc, chunksByDoc, { ...templateDef, requiredDocuments: requiredDocs });
    if (classified) {
      uploadedDocTypes.push({ ...classified, documentId: doc.id, filename: doc.filename });
      matchedTypes.add(classified.type);
    } else {
      uploadedDocTypes.push({ type: 'unknown', label: 'Unclassified', documentId: doc.id, filename: doc.filename });
    }
  }

  // Calculate progress
  const mandatoryDocs = requiredDocs.filter(d => d.mandatory);
  const mandatoryUploaded = mandatoryDocs.filter(d => matchedTypes.has(d.type)).length;
  const totalRequired = requiredDocs.length;
  const totalUploaded = matchedTypes.size;
  const percentage = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0;

  const progress = {
    total: totalRequired,
    uploaded: totalUploaded,
    mandatory: mandatoryDocs.length,
    mandatoryUploaded,
    percentage: Math.min(100, percentage),
    status: (totalUploaded >= totalRequired ? 'complete' : totalUploaded > 0 ? 'partial' : 'pending') as 'pending' | 'partial' | 'complete',
  };

  // Missing documents
  const missingDocuments = requiredDocs
    .filter(d => !matchedTypes.has(d.type))
    .map(d => ({ type: d.type, label: d.label, mandatory: d.mandatory }));

  // Run all detections
  const formatErrors = validateFormats(documents, chunksByDoc);
  const duplicates = detectDuplicates(documents, chunksByDoc);
  const crossDocMismatches = detectCrossDocMismatches(documents);

  // Build issues list
  const issues: VendorIssue[] = [];
  let issueIdx = 0;

  // Missing document issues
  for (const missing of missingDocuments) {
    issues.push({
      id: `issue-${++issueIdx}`,
      category: 'missing',
      severity: missing.mandatory ? 'critical' : 'medium',
      title: `Missing: ${missing.label}`,
      description: `The vendor has not submitted ${missing.label}. ${missing.mandatory ? 'This is a mandatory document.' : 'This document is recommended.'}`,
      affectedDocuments: [],
      affectedDocumentNames: [],
      recommendation: `Request the vendor to upload their ${missing.label}.`,
      autoDetected: true,
      riskPoints: missing.mandatory ? 20 : 5,
    });
  }

  // Format error issues
  for (const err of formatErrors) {
    issues.push({
      id: `issue-${++issueIdx}`,
      category: 'format_error',
      severity: 'high',
      title: `Invalid ${err.field} format in ${err.filename}`,
      description: `${err.field} value "${err.value}" does not match expected format: ${err.expected}`,
      affectedDocuments: [err.documentId],
      affectedDocumentNames: [err.filename],
      recommendation: `Verify the ${err.field} and request corrected document if invalid.`,
      autoDetected: true,
      riskPoints: 15,
    });
  }

  // Duplicate issues
  for (const dup of duplicates) {
    issues.push({
      id: `issue-${++issueIdx}`,
      category: 'fraud',
      severity: dup.reason.includes('invoice') ? 'critical' : 'high',
      title: `Duplicate detected: ${dup.filenames.join(', ')}`,
      description: dup.reason,
      affectedDocuments: dup.documentIds,
      affectedDocumentNames: dup.filenames,
      recommendation: 'Review and remove duplicate documents. If invoice duplicates, investigate for potential fraud.',
      autoDetected: true,
      riskPoints: dup.reason.includes('invoice') ? 25 : 10,
    });
  }

  // Cross-document mismatch issues
  for (const mm of crossDocMismatches) {
    issues.push({
      id: `issue-${++issueIdx}`,
      category: 'mismatch',
      severity: mm.field.includes('PAN vs GST') ? 'critical' : 'high',
      title: `${mm.field} mismatch across documents`,
      description: mm.description,
      affectedDocuments: documents.map((d: any) => d.id),
      affectedDocumentNames: documents.map((d: any) => d.filename),
      recommendation: 'Cross-verify all details with original documents and vendor registration records.',
      autoDetected: true,
      riskPoints: mm.field.includes('PAN') ? 20 : 15,
    });
  }

  // Risk-level based issues
  for (const doc of documents) {
    if (doc.risk_level === 'Critical') {
      issues.push({
        id: `issue-${++issueIdx}`,
        category: 'warning',
        severity: 'critical',
        title: `Critical risk in ${doc.filename}`,
        description: doc.summary || `Document flagged as Critical risk by AI analysis.`,
        affectedDocuments: [doc.id],
        affectedDocumentNames: [doc.filename],
        recommendation: 'Do not proceed without thorough manual review of this document.',
        autoDetected: true,
        riskPoints: 25,
      });
    } else if (doc.risk_level === 'Warning') {
      issues.push({
        id: `issue-${++issueIdx}`,
        category: 'warning',
        severity: 'high',
        title: `Warning risk in ${doc.filename}`,
        description: doc.summary || `Document flagged as Warning risk by AI analysis.`,
        affectedDocuments: [doc.id],
        affectedDocumentNames: [doc.filename],
        recommendation: 'Review this document carefully before approval.',
        autoDetected: true,
        riskPoints: 12,
      });
    }
  }

  // AI-powered deep analysis
  if (config.openai.apiKey && documents.length > 0) {
    try {
      const aiIssues = await runAIAnalysis(documents, chunksByDoc, vendorName);
      for (const ai of aiIssues) {
        issues.push({ ...ai, id: `issue-${++issueIdx}` });
      }
    } catch (e) {
      console.warn('AI vendor analysis failed, using rule-based results only:', e);
    }
  }

  // Risk scoring
  const totalRiskPoints = issues.reduce((sum, i) => sum + i.riskPoints, 0);
  const overallRiskScore = Math.max(0, Math.min(100, 100 - totalRiskPoints));

  const overallRiskLevel: VendorAnalysisResult['overallRiskLevel'] =
    overallRiskScore >= 70 ? 'Safe' :
    overallRiskScore >= 40 ? 'Warning' : 'Critical';

  const categories: Record<IssueCategory, number> = {
    missing: 0, mismatch: 0, format_error: 0, fraud: 0, warning: 0, suggestion: 0,
  };
  for (const issue of issues) {
    categories[issue.category] = (categories[issue.category] || 0) + 1;
  }

  const vendorHealthScore = Math.round(
    (progress.percentage * 0.4) +
    (overallRiskScore * 0.6)
  );

  // Sort by severity
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

  const summary = buildSummary(vendorName, documents.length, issues, missingDocuments, progress, overallRiskLevel, overallRiskScore);

  return {
    overallRiskScore,
    overallRiskLevel,
    totalDocuments: documents.length,
    issuesCount: issues.length,
    issues,
    missingDocuments,
    uploadedDocumentTypes: uploadedDocTypes,
    progress,
    summary,
    vendorHealthScore: Math.min(100, vendorHealthScore),
    categories,
    duplicates,
    formatErrors: formatErrors.map(e => ({ field: e.field, value: e.value, expected: e.expected, documentId: e.documentId })),
    crossDocMismatches,
  };
}

function buildSummary(
  vendorName: string,
  docCount: number,
  issues: VendorIssue[],
  missing: any[],
  progress: any,
  riskLevel: string,
  riskScore: number
): string {
  const lines: string[] = [];
  lines.push(`Vendor "${vendorName}": ${docCount} document(s) submitted.`);
  lines.push(`Progress: ${progress.uploaded}/${progress.total} required documents (${progress.percentage}%).`);
  if (progress.mandatoryUploaded < progress.mandatory) {
    lines.push(`${progress.mandatory - progress.mandatoryUploaded} mandatory document(s) still missing.`);
  }
  lines.push(`${issues.length} issue(s) detected. Risk: ${riskLevel} (${riskScore}/100).`);
  const critical = issues.filter(i => i.severity === 'critical').length;
  if (critical > 0) lines.push(`${critical} CRITICAL issue(s) require immediate attention.`);
  if (missing.length > 0) lines.push(`Missing: ${missing.map(m => m.label).join(', ')}.`);
  return lines.join(' ');
}

async function runAIAnalysis(
  documents: any[],
  chunksByDoc: Record<string, string[]>,
  vendorName: string
): Promise<Omit<VendorIssue, 'id'>[]> {
  const llm = new ChatOpenAI({
    openAIApiKey: config.openai.apiKey,
    modelName: 'gpt-4o-mini',
    temperature: 0.1,
  });

  const docSummaries = documents.map((d) => {
    const chunks = (chunksByDoc[d.id] || []).join('\n').slice(0, 1200);
    return `--- ${d.filename} (risk: ${d.risk_level}, score: ${d.risk_score ?? 'N/A'}) ---\n${d.summary || ''}\n${chunks}`;
  }).join('\n\n');

  const prompt = `You are Aegis AI acting as a senior CA performing vendor document review.
Vendor: ${vendorName}, Documents: ${documents.length}

${docSummaries.slice(0, 8000)}

Check for:
1. Tax calculation errors (GST rates, TDS deductions)
2. Date inconsistencies between documents
3. Signature or letterhead issues
4. Amount mismatches (invoice vs PO vs payment)
5. Compliance gaps (missing declarations, stamps)

Return ONLY a JSON array. Each item:
{"category":"mismatch"|"fraud"|"warning"|"suggestion","severity":"critical"|"high"|"medium"|"low","title":"...","description":"...","affectedDocumentNames":["..."],"recommendation":"...","riskPoints":number}

Return [] if no additional issues. ONLY valid JSON array.`;

  const resp = await llm.invoke(prompt);
  const content = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item.title && item.category)
      .map((item: any) => ({
        category: (['missing', 'mismatch', 'format_error', 'fraud', 'warning', 'suggestion'].includes(item.category) ? item.category : 'warning') as IssueCategory,
        severity: (['critical', 'high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium') as IssueSeverity,
        title: String(item.title),
        description: String(item.description || ''),
        affectedDocuments: [],
        affectedDocumentNames: Array.isArray(item.affectedDocumentNames) ? item.affectedDocumentNames : [],
        recommendation: String(item.recommendation || 'Review and verify.'),
        autoDetected: true,
        riskPoints: typeof item.riskPoints === 'number' ? item.riskPoints : 10,
      }));
  } catch {
    return [];
  }
}
