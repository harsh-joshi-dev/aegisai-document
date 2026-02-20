import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { pool } from '../db/pgvector.js';

// ============================================================
// Types
// ============================================================

export interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
  rate?: number;
  tax?: number;
  documentId: string;
  documentName: string;
  itemCategory?: 'operating' | 'financing' | 'investing' | 'tax' | 'info';
}

export interface MoneyEntry {
  type: 'inflow' | 'outflow';
  amount: number;
  date: string | null;
  description: string;
  documentId: string;
  documentName: string;
  matched: boolean;
  matchedWith?: string;
  category: string;
  source: 'pnl' | 'bank' | 'itr' | 'invoice' | 'gst' | 'balance_sheet' | 'contract' | 'other';
}

export interface UntracedItem {
  type: 'invoice_no_payment' | 'payment_no_invoice' | 'amount_mismatch' | 'tax_gap' | 'unaccounted_expense' | 'missing_receipt';
  severity: 'high' | 'medium' | 'low';
  amount: number;
  description: string;
  documentId?: string;
  documentName?: string;
  recommendation: string;
}

export interface TaxEntry {
  type: 'gst_collected' | 'gst_paid' | 'gst_input_credit' | 'tds_deducted' | 'tds_deposited' | 'income_tax_liability' | 'income_tax_paid' | 'other_tax';
  amount: number;
  rate?: number;
  documentId: string;
  documentName: string;
  description: string;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  taxPaid: number;
}

export interface VendorFinancialAnalysis {
  // Summary
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  totalTaxLiability: number;
  totalTaxPaid: number;
  taxGap: number;

  // Detailed breakdown
  revenueBreakdown: { category: string; amount: number; count: number; percentage: number }[];
  expenseBreakdown: { category: string; amount: number; count: number; percentage: number }[];

  // Money tracking
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  moneyEntries: MoneyEntry[];

  // Untraced money
  totalUntracedAmount: number;
  untracedItems: UntracedItem[];

  // Tax
  taxEntries: TaxEntry[];
  gstSummary: { collected: number; paid: number; inputCredit: number; netLiability: number };
  tdsSummary: { applicable: number; deducted: number; deposited: number; gap: number };
  incomeTaxSummary?: { liability: number; paid: number; gap: number };

  // Data source info
  revenueSource?: string;

  // Trends
  monthlyData: MonthlyData[];

  // Line items
  topRevenueItems: LineItem[];
  topExpenseItems: LineItem[];

  // AI Insights
  insights: string[];
  warnings: string[];
  recommendations: string[];

  // Meta
  documentsAnalyzed: number;
  documentsSkipped: number;
  financialYear: string | null;
  documentTypes: { type: string; count: number; financialYear: string | null }[];
  analysisDate: string;
  summary: string;
}

// ============================================================
// Main Analysis Function
// ============================================================

export async function analyzeVendorFinancials(params: {
  tenantId: string;
  folderId: string;
  vendorName: string;
}): Promise<VendorFinancialAnalysis> {
  const { tenantId, folderId, vendorName } = params;

  // Fetch all documents with extracted data
  const docsResult = await pool.query(
    `SELECT d.id, d.filename, d.extracted_data, d.summary, d.risk_level,
            d.risk_score, d.metadata, d.uploaded_at, d.file_type
     FROM documents d
     WHERE d.tenant_id = $1 AND d.folder_id = $2
     ORDER BY d.uploaded_at ASC`,
    [tenantId, folderId]
  );
  const documents = docsResult.rows as any[];

  // Fetch all text chunks for deep extraction
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

  // Phase 1: Extract financial data from each document
  const allMoneyEntries: MoneyEntry[] = [];
  const allLineItems: LineItem[] = [];
  const allTaxEntries: TaxEntry[] = [];
  
  const docTypeCounter: Record<string, { count: number; fy: string | null }> = {};
  let skippedCount = 0;
  const detectedFYs: string[] = [];

  for (const doc of documents) {
    const extracted = parseExtracted(doc.extracted_data);
    const text = (chunksByDoc[doc.id] || []).join('\n');
    const fname = (doc.filename || '').toLowerCase();

    const docSummary = doc.summary || '';
    const docFinancials = extractDocumentFinancials(doc.id, doc.filename, extracted, text, fname, docSummary);

    // Track doc type & FY
    if (!docTypeCounter[docFinancials.docType]) docTypeCounter[docFinancials.docType] = { count: 0, fy: null };
    docTypeCounter[docFinancials.docType].count++;
    if (docFinancials.financialYear) {
      docTypeCounter[docFinancials.docType].fy = docFinancials.financialYear;
      detectedFYs.push(docFinancials.financialYear);
    }

    if (docFinancials.skipped) { skippedCount++; continue; }

    allMoneyEntries.push(...docFinancials.entries);
    allLineItems.push(...docFinancials.lineItems);
    allTaxEntries.push(...docFinancials.taxEntries);

    
  }

  // Determine primary financial year
  const primaryFY = detectedFYs.length > 0
    ? detectedFYs.sort((a, b) => detectedFYs.filter(v => v === b).length - detectedFYs.filter(v => v === a).length)[0]
    : null;
  const documentTypes = Object.entries(docTypeCounter).map(([type, d]) => ({ type, count: d.count, financialYear: d.fy }));

  // ================================================================
  // Phase 2: SOURCE-AWARE aggregation
  // P&L is authoritative for revenue/expenses. Bank is cash flow only.
  // ITR is authoritative for income tax. GST docs for GST.
  // ================================================================

  const pnlInflows = allMoneyEntries.filter(e => e.source === 'pnl' && e.type === 'inflow');
  const pnlOutflows = allMoneyEntries.filter(e => e.source === 'pnl' && e.type === 'outflow');
  const bankInflows = allMoneyEntries.filter(e => e.source === 'bank' && e.type === 'inflow');
  const bankOutflows = allMoneyEntries.filter(e => e.source === 'bank' && e.type === 'outflow');
  const invoiceInflows = allMoneyEntries.filter(e => e.source === 'invoice' && e.type === 'inflow');
  const invoiceOutflows = allMoneyEntries.filter(e => e.source === 'invoice' && e.type === 'outflow');
  const hasPnL = pnlInflows.length > 0 || pnlOutflows.length > 0;

  // Revenue: P&L first → invoices → GST turnover → fall back to bank ONLY if nothing else
  let totalRevenue: number;
  let totalExpenses: number;
  let revenueSource: string;

  if (hasPnL) {
    // Use the SINGLE LARGEST P&L revenue & expense (not sum) to prevent double-counting
    // when multiple docs or FY columns produce P&L entries
    totalRevenue = pnlInflows.length > 0 ? Math.max(...pnlInflows.map(e => e.amount)) : 0;
    totalExpenses = pnlOutflows.length > 0 ? Math.max(...pnlOutflows.map(e => e.amount)) : 0;
    revenueSource = 'P&L Account';
  } else if (invoiceInflows.length > 0 || invoiceOutflows.length > 0) {
    totalRevenue = invoiceInflows.reduce((s, e) => s + e.amount, 0);
    totalExpenses = invoiceOutflows.reduce((s, e) => s + e.amount, 0);
    revenueSource = 'Invoices/POs';
  } else {
    const nonBankInflows = allMoneyEntries.filter(e => e.source !== 'bank' && e.type === 'inflow');
    const nonBankOutflows = allMoneyEntries.filter(e => e.source !== 'bank' && e.type === 'outflow');
    if (nonBankInflows.length > 0) {
      totalRevenue = nonBankInflows.reduce((s, e) => s + e.amount, 0);
      totalExpenses = nonBankOutflows.reduce((s, e) => s + e.amount, 0);
      revenueSource = 'Documents';
    } else {
      totalRevenue = bankInflows.reduce((s, e) => s + e.amount, 0);
      totalExpenses = bankOutflows.reduce((s, e) => s + e.amount, 0);
      revenueSource = 'Bank Statement (cash-flow based — no P&L available)';
    }
  }

  const grossProfit = totalRevenue - totalExpenses;

  // Cash flow — ALWAYS from bank
  const totalBankCredits = bankInflows.reduce((s, e) => s + e.amount, 0);
  const totalBankDebits = bankOutflows.reduce((s, e) => s + e.amount, 0);
  const netCashFlow = totalBankCredits - totalBankDebits;

  // ================================================================
  // Tax calculations — separate GST from Income Tax
  // ================================================================

  // GST
  const gstCollected = allTaxEntries.filter(t => t.type === 'gst_collected').reduce((s, t) => s + t.amount, 0);
  const gstPaid = allTaxEntries.filter(t => t.type === 'gst_paid').reduce((s, t) => s + t.amount, 0);
  const gstInputCredit = allTaxEntries.filter(t => t.type === 'gst_input_credit').reduce((s, t) => s + t.amount, 0);
  const gstNetLiability = gstCollected - gstInputCredit;

  // TDS (from invoices/TDS certificates)
  const tdsApplicable = allTaxEntries.filter(t => t.type === 'tds_deducted').reduce((s, t) => s + t.amount, 0);
  const tdsDeducted = tdsApplicable;
  const tdsDeposited = allTaxEntries.filter(t => t.type === 'tds_deposited').reduce((s, t) => s + t.amount, 0);

  // Income Tax (from ITR) — liability vs paid
  const incomeTaxLiability = allTaxEntries.filter(t => t.type === 'income_tax_liability').reduce((s, t) => s + t.amount, 0);
  const incomeTaxPaid = allTaxEntries.filter(t => t.type === 'income_tax_paid').reduce((s, t) => s + t.amount, 0);
  const incomeTaxGap = Math.max(0, incomeTaxLiability - incomeTaxPaid);

  const otherTaxPaid = allTaxEntries.filter(t => t.type === 'other_tax').reduce((s, t) => s + t.amount, 0);

  // Total tax: When ITR data is present, it's the SINGLE SOURCE OF TRUTH for income tax.
  // ITR "Tax Payable" already accounts for TDS deducted on invoices, so don't double-count.
  // Only add invoice TDS separately when there's NO ITR data.
  const hasITR = incomeTaxLiability > 0 || incomeTaxPaid > 0;
  const totalTaxLiability = Math.max(0, gstNetLiability) + (hasITR ? incomeTaxLiability : tdsApplicable);
  const totalTaxPaid = gstPaid + (hasITR ? incomeTaxPaid : tdsDeposited) + otherTaxPaid;
  const taxGap = Math.max(0, totalTaxLiability - totalTaxPaid);

  // Net profit from P&L: revenue - expenses - tax from P&L
  // Use PAT from line items if available
  const patItem = allLineItems.find(l => l.description.includes('Profit After Tax') || l.description.includes('PAT'));
  const netProfit = patItem ? patItem.amount : (grossProfit - Math.max(0, incomeTaxLiability));
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // ================================================================
  // Untraced money — genuine discrepancies only
  // ================================================================
  const untracedItems = findUntracedMoney(allMoneyEntries, allTaxEntries, allLineItems, totalRevenue, totalBankCredits, totalExpenses, totalBankDebits, hasPnL);
  const totalUntracedAmount = untracedItems.reduce((s, u) => s + u.amount, 0);

  // Revenue/Expense breakdowns — only from the selected source
  const relevantRevEntries = hasPnL
    ? allMoneyEntries.filter(e => e.source === 'pnl' && e.type === 'inflow')
    : allMoneyEntries.filter(e => e.source !== 'bank' && e.type === 'inflow');
  const relevantExpEntries = hasPnL
    ? allMoneyEntries.filter(e => e.source === 'pnl' && e.type === 'outflow')
    : allMoneyEntries.filter(e => e.source !== 'bank' && e.type === 'outflow');

  const revByCat: Record<string, { amount: number; count: number }> = {};
  for (const e of relevantRevEntries) {
    const cat = e.category || 'Other Revenue';
    if (!revByCat[cat]) revByCat[cat] = { amount: 0, count: 0 };
    revByCat[cat].amount += e.amount;
    revByCat[cat].count++;
  }
  // Always include bank cash flow in breakdown for visibility
  if (totalBankCredits > 0) {
    revByCat['Bank Credits (Cash Flow)'] = { amount: totalBankCredits, count: bankInflows.length };
  }
  const revenueBreakdown = Object.entries(revByCat)
    .map(([category, d]) => ({ category, amount: d.amount, count: d.count, percentage: totalRevenue > 0 ? Math.round((d.amount / totalRevenue) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const expByCat: Record<string, { amount: number; count: number }> = {};
  for (const e of relevantExpEntries) {
    const cat = e.category || 'Other Expense';
    if (!expByCat[cat]) expByCat[cat] = { amount: 0, count: 0 };
    expByCat[cat].amount += e.amount;
    expByCat[cat].count++;
  }
  if (totalBankDebits > 0) {
    expByCat['Bank Debits (Cash Flow)'] = { amount: totalBankDebits, count: bankOutflows.length };
  }
  const expenseBreakdown = Object.entries(expByCat)
    .map(([category, d]) => ({ category, amount: d.amount, count: d.count, percentage: totalExpenses > 0 ? Math.round((d.amount / totalExpenses) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Monthly trends (from P&L entries if available, else all)
  const trendEntries = hasPnL ? allMoneyEntries.filter(e => e.source === 'pnl') : allMoneyEntries.filter(e => e.source !== 'bank');
  const monthlyData = buildMonthlyTrends(trendEntries.length > 0 ? trendEntries : allMoneyEntries, allTaxEntries);

  // Top items
  const topRevenueItems = allLineItems
    .filter(l => l.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  const topExpenseItems = allLineItems
    .filter(l => l.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 10)
    .map(i => ({ ...i, amount: Math.abs(i.amount) }));

  // Phase 3: AI-powered deep insights
  let insights: string[] = [];
  let warnings: string[] = [];
  let recommendations: string[] = [];

  if (config.openai.apiKey && documents.length > 0) {
    try {
      const aiResult = await generateAIFinancialInsights({
        vendorName, totalRevenue, totalExpenses, grossProfit, netProfit, profitMargin,
        totalUntracedAmount, taxGap, untracedItems, revenueBreakdown, expenseBreakdown,
        monthlyData, documents, chunksByDoc,
      });
      insights = aiResult.insights;
      warnings = aiResult.warnings;
      recommendations = aiResult.recommendations;
    } catch (e) {
      console.warn('AI financial insights failed:', e);
    }
  }

  if (insights.length === 0) {
    insights = generateRuleBasedInsights(totalRevenue, totalExpenses, grossProfit, profitMargin, totalUntracedAmount, taxGap, untracedItems.length, documents.length);
  }

  const summary = buildFinancialSummary(vendorName, totalRevenue, totalExpenses, grossProfit, netProfit, profitMargin, totalUntracedAmount, taxGap, untracedItems.length, documents.length);

  return {
    totalRevenue, totalExpenses, grossProfit, netProfit, profitMargin,
    totalTaxLiability, totalTaxPaid, taxGap,
    revenueBreakdown, expenseBreakdown,
    totalInflow: totalBankCredits, totalOutflow: totalBankDebits, netCashFlow,
    moneyEntries: allMoneyEntries,
    totalUntracedAmount, untracedItems,
    taxEntries: allTaxEntries,
    gstSummary: { collected: gstCollected, paid: gstPaid, inputCredit: gstInputCredit, netLiability: gstNetLiability },
    tdsSummary: {
      applicable: tdsApplicable,
      deducted: tdsDeducted,
      deposited: hasITR ? tdsApplicable : tdsDeposited,
      gap: hasITR ? 0 : Math.max(0, tdsApplicable - tdsDeposited),
    },
    incomeTaxSummary: { liability: incomeTaxLiability, paid: incomeTaxPaid, gap: incomeTaxGap },
    revenueSource,
    monthlyData, topRevenueItems, topExpenseItems,
    insights, warnings, recommendations,
    documentsAnalyzed: documents.length,
    documentsSkipped: skippedCount,
    financialYear: primaryFY,
    documentTypes,
    analysisDate: new Date().toISOString(),
    summary,
  };
}

// ============================================================
// Document-Level Financial Extraction
// ============================================================

function parseExtracted(data: any): Record<string, any> {
  if (!data) return {};
  if (typeof data === 'string') { try { return JSON.parse(data); } catch { return {}; } }
  return data;
}

// Indian number format: ₹9,50,37,000 or 9,42,07,000 or 19,85,000
function parseIndianAmount(val: string): number {
  const cleaned = val.replace(/[₹$\s]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseAmount(val: any): number {
  if (typeof val === 'number') return Math.abs(val);
  if (typeof val === 'string') return parseIndianAmount(val);
  return 0;
}

// Master regex for Indian currency amounts: ₹9,50,37,000 or Rs. 19,85,000
const AMOUNT_REGEX = /(?:₹|rs\.?\s*|inr\s*)([\d,]{3,17}(?:\.\d{1,2})?)(?![\d,])/gi;

// Helper: build pattern that handles text like "Total Credits for FY 2024-25: ₹9,50,37,000"
// Uses .{0,120}? (lazy, bounded) to skip dates/years, then requires ₹/Rs before the number
function namedPat(prefix: string): RegExp {
  // Cap amount capture at 17 chars (handles up to ₹99,99,99,99,999 = ~₹10,000 Cr)
  return new RegExp(`${prefix}.{0,120}?(?:₹|rs\\.?\\s*|inr\\s*)(\\d[\\d,]{2,16}(?:\\.\\d{1,2})?)(?![\\d,])`, 'gi');
}
// Colon variant for "Total Credits: 9,50,37,000" (no currency symbol, require colon)
function colonPat(prefix: string): RegExp {
  return new RegExp(`${prefix}\\s*:\\s*(\\d[\\d,]{3,16}(?:\\.\\d{1,2})?)(?![\\d,])`, 'gi');
}

const NAMED_AMOUNT_PATTERNS: [RegExp, string, 'inflow' | 'outflow'][] = [
  // Bank statement patterns
  [namedPat('total\\s+credits?'), 'Total Credits', 'inflow'],
  [colonPat('total\\s+credits?'), 'Total Credits', 'inflow'],
  [namedPat('total\\s+debits?'), 'Total Debits', 'outflow'],
  [colonPat('total\\s+debits?'), 'Total Debits', 'outflow'],
  [namedPat('net\\s+(?:flow|cash\\s*flow)'), 'Net Cash Flow', 'inflow'],
  [colonPat('net\\s+(?:flow|cash\\s*flow)'), 'Net Cash Flow', 'inflow'],
  [namedPat('closing\\s+balance'), 'Closing Balance', 'inflow'],
  [colonPat('closing\\s+balance'), 'Closing Balance', 'inflow'],
  [namedPat('opening\\s+balance'), 'Opening Balance', 'inflow'],
  [colonPat('opening\\s+balance'), 'Opening Balance', 'inflow'],
  // Income/revenue patterns
  [namedPat('(?:total\\s+)?(?:income|revenue|turnover|sales)'), 'Total Income', 'inflow'],
  [colonPat('(?:total\\s+)?(?:income|revenue|turnover|sales)'), 'Total Income', 'inflow'],
  [namedPat('gross\\s+(?:receipt|income|revenue|total)'), 'Gross Revenue', 'inflow'],
  // Expense patterns
  [namedPat('(?:total\\s+)?(?:expenditure|expenses?|cost)'), 'Total Expenses', 'outflow'],
  [colonPat('(?:total\\s+)?(?:expenditure|expenses?|cost)'), 'Total Expenses', 'outflow'],
  [namedPat('(?:total\\s+)?(?:purchase|procurement)'), 'Total Purchases', 'outflow'],
  // Profit patterns
  [namedPat('(?:net\\s+)?profit\\s+(?:before|after|for)'), 'Net Profit', 'inflow'],
  [namedPat('profit\\s+(?:&|and)\\s+loss'), 'P&L', 'inflow'],
  // Invoice patterns
  [namedPat('(?:grand\\s+)?total\\s*(?:amount)?'), 'Total Amount', 'inflow'],
  [colonPat('(?:grand\\s+)?total\\s*(?:amount)?'), 'Total Amount', 'inflow'],
  [namedPat('invoice\\s+(?:amount|value|total)'), 'Invoice Amount', 'inflow'],
  [namedPat('(?:amount\\s+)?(?:payable|receivable|due)'), 'Amount Due', 'inflow'],
  // Tax patterns — GST
  [namedPat('(?:total\\s+)?(?:gst|igst|cgst|sgst)\\s*(?:amount|payable|liability)?'), 'GST Amount', 'outflow'],
  [colonPat('(?:total\\s+)?(?:gst|igst|cgst|sgst)\\s*(?:amount|payable|liability)?'), 'GST Amount', 'outflow'],
  [namedPat('(?:output\\s+)?(?:gst|tax)\\s*(?:collected|on\\s+sales)'), 'GST Collected', 'outflow'],
  [namedPat('(?:input\\s+(?:tax\\s+)?credit|itc)\\s*(?:claimed|available)?'), 'Input Tax Credit', 'inflow'],
  [colonPat('(?:input\\s+(?:tax\\s+)?credit|itc)'), 'Input Tax Credit', 'inflow'],
  [namedPat('(?:net\\s+)?gst\\s*(?:liability|payable)'), 'Net GST Liability', 'outflow'],
  [namedPat('gst\\s+(?:paid|deposited|remitted)'), 'GST Paid', 'outflow'],
  [colonPat('gst\\s+(?:paid|deposited)'), 'GST Paid', 'outflow'],
  // Tax patterns — TDS
  [namedPat('(?:total\\s+)?tds\\s*(?:amount|deducted|applicable)?'), 'TDS Amount', 'outflow'],
  [colonPat('(?:total\\s+)?tds\\s*(?:amount|deducted)?'), 'TDS Amount', 'outflow'],
  [namedPat('tds\\s+(?:deposited|paid|remitted)'), 'TDS Deposited', 'outflow'],
  [colonPat('tds\\s+(?:deposited|paid)'), 'TDS Deposited', 'outflow'],
  // Tax patterns — Income Tax (ITR)
  [namedPat('(?:total\\s+)?(?:taxable\\s+)?income'), 'Total Taxable Income', 'inflow'],
  [colonPat('(?:total\\s+)?(?:taxable\\s+)?income'), 'Total Taxable Income', 'inflow'],
  // "Tax Payable" = LIABILITY (not yet paid)
  [namedPat('tax\\s+payable'), 'Tax Payable', 'outflow'],
  [colonPat('tax\\s+payable'), 'Tax Payable', 'outflow'],
  // "Tax Paid/Deposited" = ACTUALLY PAID
  [namedPat('tax\\s+(?:paid|deposited)'), 'Tax Paid', 'outflow'],
  [colonPat('tax\\s+(?:paid|deposited)'), 'Tax Paid', 'outflow'],
  // "TDS/Advance Tax" or "Advance Tax" = paid against liability
  [namedPat('(?:tds[/\\s]*)?advance\\s+tax\\s*(?:paid)?'), 'Advance Tax Paid', 'outflow'],
  [colonPat('(?:tds[/\\s]*)?advance\\s+tax'), 'Advance Tax Paid', 'outflow'],
  [namedPat('self[\\s-]?assessment\\s+tax'), 'Self Assessment Tax', 'outflow'],
  [colonPat('self[\\s-]?assessment\\s+tax'), 'Self Assessment Tax', 'outflow'],
  // "Net Tax Payable" — if NIL/0, means taxes fully paid
  [namedPat('net\\s+tax\\s+payable'), 'Net Tax Payable', 'outflow'],
  [colonPat('net\\s+tax\\s+payable'), 'Net Tax Payable', 'outflow'],
  // Revenue from operations (P&L specific)
  [namedPat('revenue\\s+from\\s+operations'), 'Revenue from Operations', 'inflow'],
  [colonPat('revenue\\s+from\\s+operations'), 'Revenue from Operations', 'inflow'],
  // Profit after tax (PAT)
  [namedPat('profit\\s+after\\s+tax'), 'Profit After Tax', 'inflow'],
  [colonPat('profit\\s+after\\s+tax'), 'Profit After Tax', 'inflow'],
  // Total equity & liabilities (balance sheet)
  [namedPat('total\\s+equity'), 'Total Equity', 'inflow'],
  [colonPat('total\\s+equity'), 'Total Equity', 'inflow'],
];

interface DocFinancials {
  entries: MoneyEntry[];
  lineItems: LineItem[];
  taxEntries: TaxEntry[];
}

// Non-financial document types that should be skipped during financial analysis
const NON_FINANCIAL_DOC_TYPES = new Set([
  'cancelled_cheque', 'pan', 'aadhar', 'voter_id', 'driving_license',
  'photo_id', 'address_proof', 'certificate_of_incorporation',
  'kyc', 'registration_certificate',
]);

function classifyDocument(fname: string, text: string, extracted: any): string {
  const fl = fname.toLowerCase();
  const tl = text.toLowerCase().slice(0, 3000);
  const docType = (extracted.documentType || '').toUpperCase();

  // Use word-boundary-safe matching for filenames to avoid substring false positives
  // e.g. "Report" should NOT match "po", "Profit" should NOT match "p" in purchase
  const fnWords = fl.replace(/[^a-z0-9]/g, ' ').split(/\s+/);
  const hasWord = (w: string) => fnWords.some(fw => fw === w || fw.startsWith(w + '_') || fw.endsWith('_' + w));
  const fnHas = (s: string) => fl.includes(s);

  // === Non-financial documents (skip from financial analysis) ===
  if ((fnHas('cancel') && fnHas('cheque')) || docType === 'CANCELLED_CHEQUE' || tl.includes('cancelled cheque')) return 'cancelled_cheque';
  if ((hasWord('pan') && !fnHas('pnl') && !fnHas('company')) || docType === 'PAN_CARD' || (fnHas('pan') && fnHas('card'))) return 'pan';
  if (fnHas('aadhar') || fnHas('aadhaar') || docType === 'AADHAR') return 'aadhar';
  if (fnHas('certificate') && fnHas('incorp') || tl.includes('certificate of incorporation')) return 'certificate_of_incorporation';
  if (fnHas('voter') || (fnHas('driving') && fnHas('licen'))) return 'photo_id';
  if (fnHas('kyc')) return 'registration_certificate';

  // === Auditor's Report — MUST be checked early, before text-based P&L detection ===
  // Auditor reports mention P&L/Balance Sheet in text but are NOT those documents
  if (fnHas('auditor') || fnHas('audit_report') || fnHas('auditors_report') ||
      (fnHas('independent') && (fnHas('report') || fnHas('audit')))) return 'other';

  // === P&L / Profit & Loss — check BEFORE balance sheet ===
  // Filename-based: strongest signal
  if (fnHas('p&l') || fnHas('pnl') || fnHas('profit_loss') || fnHas('profit loss') ||
      (fnHas('profit') && (fnHas('loss') || fnHas('account'))) ||
      fnHas('statement_of_profit')) return 'pnl';
  // Text-based: only if the document is clearly a P&L statement (first 500 chars)
  const tlStart = tl.slice(0, 500);
  if (tlStart.includes('statement of profit and loss') || tlStart.includes('profit and loss account') ||
      tlStart.includes('profit & loss account') || tlStart.includes('profit and loss statement')) return 'pnl';

  // === Balance Sheet ===
  if ((fnHas('balance') && fnHas('sheet')) || (fnHas('audit') && fnHas('balance'))) return 'balance_sheet';
  if (tlStart.includes('balance sheet') && !tlStart.includes('profit and loss') && !tlStart.includes('statement of profit')) return 'balance_sheet';

  // === Bank Statement ===
  if (docType === 'BANK_STATEMENT' || (fnHas('bank') && (fnHas('statement') || fnHas('summary'))) ||
      tl.includes('account statement') || tl.includes('bank statement')) return 'bank_statement';

  // === Invoice ===
  if (docType === 'INVOICE' || fnHas('invoice') || tl.includes('invoice no') || tl.includes('tax invoice')) return 'invoice';

  // === Purchase Order — require full word, not substring match ===
  if (fnHas('purchase_order') || fnHas('purchase order') || hasWord('po') || tl.includes('purchase order')) return 'purchase_order';

  // === GST Return (not registration certificate) ===
  if (fnHas('gstr') || tl.includes('gst return') || (fnHas('gst') && !fnHas('registration') && !fnHas('certif'))) return 'gst';
  // GST Registration Certificate → non-financial (no amounts to extract)
  if (fnHas('gst') && (fnHas('registration') || fnHas('certif'))) return 'registration_certificate';

  // === ITR — MUST be before TDS because ITR documents reference TDS/Form 26AS ===
  if (fnHas('itr') || fnHas('income_tax') || fnHas('income tax') || tl.includes('income tax return') || tl.includes('computation of income')) return 'itr';
  if (tl.includes('assessment year') && tl.includes('acknowledgement')) return 'itr';

  // === TDS (standalone TDS certificates, not ITR referencing TDS) ===
  if (fnHas('tds') || fnHas('form 16') || fnHas('form16') || tl.includes('tax deducted at source') || tl.includes('form 26as')) return 'tds';

  // === Contract / Agreement ===
  if (fnHas('agreement') || fnHas('contract')) return 'contract';

  // === Ledger ===
  if (fnHas('ledger') || tl.includes('ledger')) return 'ledger';

  // === Salary ===
  if (fnHas('salary') || fnHas('payslip') || tl.includes('salary slip')) return 'salary';

  // === Bill (like invoice) ===
  if (fnHas('bill') && !fnHas('electricity')) return 'invoice';

  // === KYC / Registration forms ===
  if (fnHas('kyc') || (fnHas('registration') && fnHas('certif'))) return 'registration_certificate';

  // === Text-based fallbacks (less reliable) — only for deeper text, NOT auditor reports ===
  if ((tl.includes('profit and loss') || tl.includes('profit & loss')) && !tl.includes('auditor') && !tl.includes('independent')) return 'pnl';
  if (tl.includes('balance sheet') && !tl.includes('auditor') && !tl.includes('independent')) return 'balance_sheet';

  return 'other';
}

function extractFYFromText(text: string): string | null {
  // "FY 2024-25", "FY2024-2025", "Assessment Year 2025-26", "2024-2025"
  const fyPat = /(?:fy|financial\s+year|assessment\s+year)\s*:?\s*(\d{4})\s*[-–]\s*(\d{2,4})/gi;
  let m;
  while ((m = fyPat.exec(text)) !== null) {
    const start = m[1];
    const end = m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2];
    return `FY ${start}-${end.slice(2)}`;
  }
  // "01 April 2024 – 31 March 2025"
  const periodPat = /(?:april|apr)\s+(\d{4})\s*[-–]\s*(?:.*?)(?:march|mar)\s+(\d{4})/gi;
  while ((m = periodPat.exec(text)) !== null) {
    return `FY ${m[1]}-${m[2].slice(2)}`;
  }
  return null;
}

/**
 * Direct ITR field extraction — handles all common ITR formats:
 * - "Tax Payable: ₹29,50,000"  (colon + ₹)
 * - "Tax Payable29,50,000"       (label directly concatenated with number)
 * - "Tax Payable (as per return)29,50,000" (label + parenthetical + number)
 * - "Net Tax Payable / RefundNil"
 */
function extractITRFields(text: string): {
  taxableIncome: number;
  taxPayable: number;
  tdsAdvanceTaxPaid: number;
  selfAssessmentTax: number;
  netPayableNil: boolean;
} {
  // Flexible amount extractor: finds number right after label, with optional ₹/:/ before it
  function extractAfterLabel(label: RegExp): number {
    const fullPat = new RegExp(label.source + '[^\\d₹]*?(?:₹|rs\\.?\\s*)?\\s*(\\d[\\d,]{2,16}(?:\\.\\d{1,2})?)(?![\\d,])', 'gi');
    let best = 0;
    let m;
    while ((m = fullPat.exec(text)) !== null) {
      const amt = parseIndianAmount(m[1]);
      if (amt > best) best = amt;
    }
    return best;
  }

  const taxableIncome = extractAfterLabel(/(?:total\s+)?taxable\s+income/);
  const taxPayable = extractAfterLabel(/tax\s+payable(?:\s*\([^)]*\))?/);
  const tdsAdvanceTaxPaid = extractAfterLabel(/(?:tds\s*[/\s]+\s*)?advance\s+tax\s*(?:paid)?/);
  const selfAssessmentTax = extractAfterLabel(/self[-\s]?assessment\s+tax(?:\s+paid)?/);

  // Check for "Net Tax Payable / Refund" or "Balance Tax Payable / Refund" → Nil / 0
  const netPayableNil = /(?:net|balance)\s+tax\s+payable\s*(?:\/\s*refund)?\s*(?:nil|0|zero|—|–|-)\b/i.test(text);

  return { taxableIncome, taxPayable, tdsAdvanceTaxPaid, selfAssessmentTax, netPayableNil };
}

function extractDocumentFinancials(docId: string, docName: string, extracted: any, text: string, fname: string, summary: string): DocFinancials & { docType: string; financialYear: string | null; skipped: boolean } {
  const entries: MoneyEntry[] = [];
  const lineItems: LineItem[] = [];
  const taxEntries: TaxEntry[] = [];

  const docType = classifyDocument(fname, text, extracted);

  // Skip non-financial documents entirely
  if (NON_FINANCIAL_DOC_TYPES.has(docType)) {
    return { entries, lineItems, taxEntries, docType, financialYear: null, skipped: true };
  }

  // Combine summary + text for searching (summary often has the best data from AI)
  const searchText = `${summary || ''}\n${text}`;
  const dateStr = extracted.invoiceDate || extracted.date || extracted.statementDate || null;
  const financialYear = extractFYFromText(searchText);

  // === Phase 1: Extract named amounts from summary + text ===
  const foundAmounts: Map<string, { amount: number; type: 'inflow' | 'outflow'; label: string }> = new Map();

  for (const [pattern, label, flowType] of NAMED_AMOUNT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(searchText)) !== null) {
      const amt = parseIndianAmount(match[1]);
      if (amt > 0) {
        const key = `${label}_${amt}`;
        if (!foundAmounts.has(key)) {
          foundAmounts.set(key, { amount: amt, type: flowType, label });
        }
      }
    }
  }

  // === Phase 2: Use structured extracted_data as supplement ===
  const structuredAmount = parseAmount(extracted.totalAmount || extracted.total || extracted.grandTotal || extracted.invoiceAmount || extracted.amount);
  const structuredTax = parseAmount(extracted.taxAmount || extracted.gstAmount || extracted.tax || extracted.cgst || 0) +
                         parseAmount(extracted.sgst || 0) + parseAmount(extracted.igst || 0);
  const structuredTds = parseAmount(extracted.tdsAmount || extracted.tds || 0);

  // === Phase 3: Build entries based on document type ===
  if (docType === 'bank_statement') {
    // Bank entries are CASH FLOW, not revenue/expenses.
    // Pick the single best credit and debit value (avoid duplicates from namedPat + colonPat)
    const creditAmounts: number[] = [];
    const debitAmounts: number[] = [];
    for (const [, v] of foundAmounts) {
      if (v.label === 'Total Credits' && v.amount > 0) creditAmounts.push(v.amount);
      else if (v.label === 'Total Debits' && v.amount > 0) debitAmounts.push(v.amount);
      else if (v.label === 'Opening Balance') lineItems.push({ description: `Opening Balance — ${docName}`, amount: v.amount, documentId: docId, documentName: docName });
      else if (v.label === 'Closing Balance') lineItems.push({ description: `Closing Balance — ${docName}`, amount: v.amount, documentId: docId, documentName: docName });
      else if (v.label === 'Net Cash Flow') lineItems.push({ description: `Net Cash Flow — ${docName}`, amount: v.amount, documentId: docId, documentName: docName });
    }
    // Deduplicate: use the largest credit/debit (same amount from namedPat and colonPat should converge)
    const bestCredit = creditAmounts.length > 0 ? Math.max(...creditAmounts) : 0;
    const bestDebit = debitAmounts.length > 0 ? Math.max(...debitAmounts) : 0;
    if (bestCredit > 0) {
      entries.push({ type: 'inflow', amount: bestCredit, date: dateStr, description: `Bank Credits (${docName})`, documentId: docId, documentName: docName, matched: false, category: 'Bank Credits', source: 'bank' });
      lineItems.push({ description: `Total Credits — ${docName}`, amount: bestCredit, documentId: docId, documentName: docName });
    }
    if (bestDebit > 0) {
      entries.push({ type: 'outflow', amount: bestDebit, date: dateStr, description: `Bank Debits (${docName})`, documentId: docId, documentName: docName, matched: false, category: 'Bank Debits', source: 'bank' });
      lineItems.push({ description: `Total Debits — ${docName}`, amount: -bestDebit, documentId: docId, documentName: docName });
    }
  } else if (docType === 'invoice') {
    let invAmount = structuredAmount;
    if (invAmount === 0) {
      // Try from named amounts
      const totalAmt = [...foundAmounts.values()].find(v => v.label === 'Total Amount' || v.label === 'Invoice Amount' || v.label === 'Amount Due');
      if (totalAmt) invAmount = totalAmt.amount;
    }
    if (invAmount > 0) {
      entries.push({ type: 'inflow', amount: invAmount, date: dateStr, description: `Invoice: ${extracted.invoiceNumber || docName}`, documentId: docId, documentName: docName, matched: false, category: 'Invoice Revenue', source: 'invoice' });
      lineItems.push({ description: `Invoice total — ${extracted.invoiceNumber || docName}`, amount: invAmount, documentId: docId, documentName: docName });
    }
    if (structuredTax > 0) {
      taxEntries.push({ type: 'gst_collected', amount: structuredTax, rate: extracted.gstRate, documentId: docId, documentName: docName, description: `GST on invoice ${extracted.invoiceNumber || ''}` });
    } else {
      const gstAmt = [...foundAmounts.values()].find(v => v.label === 'GST Amount');
      if (gstAmt && gstAmt.amount > 0) {
        taxEntries.push({ type: 'gst_collected', amount: gstAmt.amount, documentId: docId, documentName: docName, description: `GST on invoice (${docName})` });
      }
    }
    if (structuredTds > 0) {
      taxEntries.push({ type: 'tds_deducted', amount: structuredTds, documentId: docId, documentName: docName, description: `TDS on invoice (${docName})` });
    }
  } else if (docType === 'purchase_order') {
    let poAmount = structuredAmount;
    if (poAmount === 0) {
      const totalAmt = [...foundAmounts.values()].find(v => v.label === 'Total Amount' || v.label === 'Total Purchases');
      if (totalAmt) poAmount = totalAmt.amount;
    }
    if (poAmount > 0) {
      entries.push({ type: 'outflow', amount: poAmount, date: dateStr, description: `PO: ${extracted.poNumber || docName}`, documentId: docId, documentName: docName, matched: false, category: 'Purchase Orders', source: 'invoice' });
      lineItems.push({ description: `PO total — ${docName}`, amount: -poAmount, documentId: docId, documentName: docName });
    }
  } else if (docType === 'pnl') {
    // P&L is the AUTHORITATIVE source for revenue and expenses.
    // Avoid double counting: pick the BEST single revenue figure and BEST single expense figure.
    // Priority: "Revenue from Operations" + "Other Income" if both exist, else largest "Total Income"
    const allRevenueAmounts: { label: string; amount: number }[] = [];
    const allExpenseAmounts: { label: string; amount: number }[] = [];
    for (const [, v] of foundAmounts) {
      if (v.label === 'Revenue from Operations' || v.label === 'Total Income' || v.label === 'Gross Revenue') {
        allRevenueAmounts.push({ label: v.label, amount: v.amount });
      } else if (v.label === 'Total Expenses' || v.label === 'Total Purchases') {
        allExpenseAmounts.push({ label: v.label, amount: v.amount });
      } else if (v.label === 'Net Profit' || v.label === 'P&L' || v.label === 'Profit After Tax') {
        lineItems.push({ description: `${v.label} — ${docName}`, amount: v.amount, documentId: docId, documentName: docName });
      } else if (v.label === 'Tax Paid' || v.label === 'Tax Payable') {
        taxEntries.push({ type: 'gst_paid', amount: v.amount, documentId: docId, documentName: docName, description: `Tax from P&L (${docName})` });
      }
    }

    // Pick the single best revenue figure (highest = "Total Income" which is the sum)
    if (allRevenueAmounts.length > 0) {
      const bestRev = allRevenueAmounts.sort((a, b) => b.amount - a.amount)[0];
      entries.push({ type: 'inflow', amount: bestRev.amount, date: dateStr, description: `${bestRev.label} (${docName})`, documentId: docId, documentName: docName, matched: false, category: bestRev.label, source: 'pnl' });
      lineItems.push({ description: `${bestRev.label} — ${docName}`, amount: bestRev.amount, documentId: docId, documentName: docName });
      // Add sub-items for reference
      for (const rev of allRevenueAmounts) {
        if (rev !== bestRev) lineItems.push({ description: `${rev.label} (component) — ${docName}`, amount: rev.amount, documentId: docId, documentName: docName });
      }
    }

    // Pick the single best expense figure (highest = "Total Expenditure")
    if (allExpenseAmounts.length > 0) {
      const bestExp = allExpenseAmounts.sort((a, b) => b.amount - a.amount)[0];
      entries.push({ type: 'outflow', amount: bestExp.amount, date: dateStr, description: `${bestExp.label} (${docName})`, documentId: docId, documentName: docName, matched: false, category: bestExp.label, source: 'pnl' });
      lineItems.push({ description: `${bestExp.label} — ${docName}`, amount: -bestExp.amount, documentId: docId, documentName: docName });
    }
  } else if (docType === 'itr') {
    // ITR: DO NOT add income as revenue (P&L is authoritative for that).
    // ITR is used ONLY for tax analysis.
    //
    // STRATEGY: Use DIRECT TEXT PARSING of common ITR fields as primary method.
    // ITR documents often have "LabelAmount" format (no colon, no ₹ symbol).
    // Fall back to named patterns only for fields not found by direct parsing.

    const itrFields = extractITRFields(searchText);

    // Record taxable income as line item (not revenue)
    if (itrFields.taxableIncome > 0) {
      lineItems.push({ description: `Taxable Income (ITR) — ${docName}`, amount: itrFields.taxableIncome, documentId: docId, documentName: docName });
    }

    // Tax Liability
    if (itrFields.taxPayable > 0) {
      taxEntries.push({ type: 'income_tax_liability', amount: itrFields.taxPayable, documentId: docId, documentName: docName, description: `Income Tax Liability (${docName})` });
    }

    // Tax Payments (TDS + Advance Tax + Self-Assessment)
    if (itrFields.tdsAdvanceTaxPaid > 0) {
      taxEntries.push({ type: 'income_tax_paid', amount: itrFields.tdsAdvanceTaxPaid, documentId: docId, documentName: docName, description: `TDS/Advance Tax Paid (${docName})` });
    }
    if (itrFields.selfAssessmentTax > 0) {
      taxEntries.push({ type: 'income_tax_paid', amount: itrFields.selfAssessmentTax, documentId: docId, documentName: docName, description: `Self-Assessment Tax Paid (${docName})` });
    }

    // If Net Tax Payable is NIL / 0
    if (itrFields.netPayableNil) {
      lineItems.push({ description: `Net Tax Payable: NIL — taxes fully paid (${docName})`, amount: 0, documentId: docId, documentName: docName });
    }

    // PAT if present
    for (const [, v] of foundAmounts) {
      if (v.label === 'Profit After Tax' || v.label === 'Net Profit') {
        lineItems.push({ description: `${v.label} (ITR) — ${docName}`, amount: v.amount, documentId: docId, documentName: docName });
      }
    }
  } else if (docType === 'gst') {
    for (const [, v] of foundAmounts) {
      if (v.label === 'GST Amount' || v.label === 'GST Collected') taxEntries.push({ type: 'gst_collected', amount: v.amount, documentId: docId, documentName: docName, description: `GST collected (${docName})` });
      else if (v.label === 'Input Tax Credit') taxEntries.push({ type: 'gst_input_credit', amount: v.amount, documentId: docId, documentName: docName, description: `ITC from ${docName}` });
      else if (v.label === 'GST Paid' || v.label === 'Tax Paid') taxEntries.push({ type: 'gst_paid', amount: v.amount, documentId: docId, documentName: docName, description: `GST paid (${docName})` });
      else if (v.label === 'Net GST Liability') taxEntries.push({ type: 'gst_collected', amount: v.amount, documentId: docId, documentName: docName, description: `Net GST liability (${docName})` });
      else if (v.label === 'Total Income' || v.label === 'Total Amount') {
        entries.push({ type: 'inflow', amount: v.amount, date: dateStr, description: `Taxable turnover (${docName})`, documentId: docId, documentName: docName, matched: false, category: 'GST Turnover', source: 'gst' });
      }
    }
    if (extracted.gstPayable) taxEntries.push({ type: 'gst_collected', amount: parseAmount(extracted.gstPayable), documentId: docId, documentName: docName, description: 'GST payable from return' });
    if (extracted.inputCredit || extracted.itc) taxEntries.push({ type: 'gst_input_credit', amount: parseAmount(extracted.inputCredit || extracted.itc), documentId: docId, documentName: docName, description: 'ITC claimed' });
  } else if (docType === 'tds') {
    const tdsAmt = structuredTds > 0 ? structuredTds : ([...foundAmounts.values()].find(v => v.label === 'TDS Amount')?.amount || 0);
    if (tdsAmt > 0) taxEntries.push({ type: 'tds_deducted', amount: tdsAmt, documentId: docId, documentName: docName, description: `TDS from ${docName}` });
    if (extracted.tdsDeposited) taxEntries.push({ type: 'tds_deposited', amount: parseAmount(extracted.tdsDeposited), documentId: docId, documentName: docName, description: `TDS deposited (${docName})` });
  } else if (docType === 'balance_sheet') {
    // Balance Sheet: LINE ITEMS ONLY — do NOT create inflow/outflow entries.
    // Balance sheet totals are not revenue/expenses.
    for (const [, v] of foundAmounts) {
      if (v.amount > 0) {
        lineItems.push({ description: `${v.label} (BS) — ${docName}`, amount: v.amount, documentId: docId, documentName: docName });
      }
    }
  } else if (docType === 'contract') {
    let contractVal = structuredAmount;
    if (contractVal === 0) {
      const totalAmt = [...foundAmounts.values()].find(v => v.label === 'Total Amount');
      if (totalAmt) contractVal = totalAmt.amount;
    }
    if (contractVal > 0) {
      entries.push({ type: 'inflow', amount: contractVal, date: dateStr, description: `Contract: ${docName}`, documentId: docId, documentName: docName, matched: false, category: 'Contract Value', source: 'contract' });
      lineItems.push({ description: `Contract value — ${docName}`, amount: contractVal, documentId: docId, documentName: docName });
    }
  } else if (docType === 'other' || docType === 'ledger' || docType === 'salary') {
    // Known non-core types: only create entries from STRUCTURED data, not raw text extraction
    if (structuredAmount > 0) {
      const flow = docType === 'salary' ? 'outflow' : 'inflow';
      entries.push({ type: flow as 'inflow' | 'outflow', amount: structuredAmount, date: dateStr, description: `Amount from ${docName}`, documentId: docId, documentName: docName, matched: false, category: docType, source: 'other' });
      lineItems.push({ description: `Amount — ${docName}`, amount: flow === 'inflow' ? structuredAmount : -structuredAmount, documentId: docId, documentName: docName });
    }
  }

  // === Phase 4: Fallback ONLY for invoice/PO types with no entries yet (data integrity) ===
  if (entries.length === 0 && (docType === 'invoice' || docType === 'purchase_order')) {
    for (const [, v] of foundAmounts) {
      if (v.amount > 100) {
        entries.push({ type: v.type, amount: v.amount, date: dateStr, description: `${v.label} (${docName})`, documentId: docId, documentName: docName, matched: false, category: v.label, source: 'other' });
        lineItems.push({ description: `${v.label} — ${docName}`, amount: v.type === 'inflow' ? v.amount : -v.amount, documentId: docId, documentName: docName });
      }
    }
  }

  // Extract line items from structured data
  if (Array.isArray(extracted.lineItems || extracted.items)) {
    for (const item of (extracted.lineItems || extracted.items)) {
      const amt = parseAmount(item.amount || item.total || item.value || 0);
      if (amt > 0) {
        lineItems.push({
          description: item.description || item.name || item.item || 'Item',
          amount: docType === 'invoice' ? amt : -amt,
          quantity: item.quantity, rate: item.rate, tax: item.tax,
          documentId: docId, documentName: docName,
        });
      }
    }
  }

  // Tag line items with accounting category based on document type
  const categoryMap: Record<string, LineItem['itemCategory']> = {
    bank_statement: 'financing',
    invoice: 'operating',
    purchase_order: 'operating',
    pnl: 'operating',
    itr: 'tax',
    gst: 'tax',
    tds: 'tax',
    balance_sheet: 'investing',
    contract: 'operating',
    ledger: 'operating',
    salary: 'operating',
  };
  const cat = categoryMap[docType] || 'info';
  for (const item of lineItems) {
    if (!item.itemCategory) item.itemCategory = cat;
  }

  return { entries, lineItems, taxEntries, docType, financialYear, skipped: false };
}

// ============================================================
// Untraced Money Detection
// ============================================================

function findUntracedMoney(
  entries: MoneyEntry[], taxEntries: TaxEntry[], lineItems: LineItem[],
  pnlRevenue: number, bankCredits: number, pnlExpenses: number, bankDebits: number, hasPnL: boolean,
): UntracedItem[] {
  const untraced: UntracedItem[] = [];

  // 1. Invoice ↔ Bank matching (only when both invoice and bank data exist)
  const invoices = entries.filter(e => e.source === 'invoice' && e.type === 'inflow');
  const bankCreditEntries = entries.filter(e => e.source === 'bank' && e.type === 'inflow');
  const pos = entries.filter(e => e.source === 'invoice' && e.type === 'outflow');
  const bankDebitEntries = entries.filter(e => e.source === 'bank' && e.type === 'outflow');

  if (invoices.length > 0 && bankCreditEntries.length > 0) {
    for (const inv of invoices) {
      const matchingCredit = bankCreditEntries.find(bc =>
        Math.abs(bc.amount - inv.amount) < inv.amount * 0.05 && !bc.matched
      );
      if (matchingCredit) {
        inv.matched = true;
        matchingCredit.matched = true;
        inv.matchedWith = matchingCredit.documentName;
        matchingCredit.matchedWith = inv.documentName;
      } else {
        untraced.push({
          type: 'invoice_no_payment',
          severity: inv.amount > 50000 ? 'high' : 'medium',
          amount: inv.amount,
          description: `Invoice "${inv.description}" (${formatCurrency(inv.amount)}) has no matching bank credit.`,
          documentId: inv.documentId, documentName: inv.documentName,
          recommendation: 'Verify if payment was received via a different account or is still outstanding.',
        });
      }
    }
  }

  if (pos.length > 0 && bankDebitEntries.length > 0) {
    for (const po of pos) {
      const matchingDebit = bankDebitEntries.find(bd =>
        Math.abs(bd.amount - po.amount) < po.amount * 0.05 && !bd.matched
      );
      if (matchingDebit) {
        po.matched = true;
        matchingDebit.matched = true;
      } else {
        untraced.push({
          type: 'unaccounted_expense',
          severity: 'medium',
          amount: po.amount,
          description: `Purchase order "${po.description}" (${formatCurrency(po.amount)}) has no matching bank payment.`,
          documentId: po.documentId, documentName: po.documentName,
          recommendation: 'Check if payment is pending or made from a different account.',
        });
      }
    }
  }

  // 2. P&L vs Bank cross-reference (only when BOTH exist)
  if (hasPnL && bankCredits > 0) {
    const creditDiff = bankCredits - pnlRevenue;
    if (creditDiff > pnlRevenue * 0.15 && creditDiff > 100000) {
      untraced.push({
        type: 'amount_mismatch',
        severity: 'low',
        amount: creditDiff,
        description: `Non-P&L cash inflow: Bank credits (${formatCurrency(bankCredits)}) exceed P&L revenue (${formatCurrency(pnlRevenue)}) by ${formatCurrency(creditDiff)}. This is normal and typically includes loan proceeds, capital infusion, inter-company transfers, and GST refunds.`,
        recommendation: 'Cross-check with Balance Sheet — new borrowings, equity infusion, or recoveries typically account for this difference.',
      });
    }

    const debitDiff = bankDebits - pnlExpenses;
    if (debitDiff > pnlExpenses * 0.15 && debitDiff > 100000) {
      untraced.push({
        type: 'amount_mismatch',
        severity: 'low',
        amount: debitDiff,
        description: `Non-P&L cash outflow: Bank debits (${formatCurrency(bankDebits)}) exceed P&L expenses (${formatCurrency(pnlExpenses)}) by ${formatCurrency(debitDiff)}. This is normal and typically includes loan principal repayments, working capital changes, capex, tax payments, and financing activities.`,
        recommendation: 'Cross-check with Balance Sheet movements — loan repayments, fixed asset purchases, changes in receivables/payables, and advance tax payments explain most of this difference.',
      });
    }
  }

  // 3. GST gap (only from actual GST documents)
  const gstCollected = taxEntries.filter(t => t.type === 'gst_collected').reduce((s, t) => s + t.amount, 0);
  const gstPaid = taxEntries.filter(t => t.type === 'gst_paid').reduce((s, t) => s + t.amount, 0);
  const gstCredit = taxEntries.filter(t => t.type === 'gst_input_credit').reduce((s, t) => s + t.amount, 0);
  const netGST = gstCollected - gstCredit;

  if (netGST > 0 && gstPaid < netGST * 0.9) {
    untraced.push({
      type: 'tax_gap',
      severity: 'high',
      amount: netGST - gstPaid,
      description: `GST gap: Liability ${formatCurrency(netGST)} but only ${formatCurrency(gstPaid)} paid. Gap: ${formatCurrency(netGST - gstPaid)}.`,
      recommendation: 'Verify GST return filings and ensure all collected GST is deposited.',
    });
  }

  // 4. Income tax gap — ONLY flag if ITR shows positive net payable
  const itLiability = taxEntries.filter(t => t.type === 'income_tax_liability').reduce((s, t) => s + t.amount, 0);
  const itPaid = taxEntries.filter(t => t.type === 'income_tax_paid').reduce((s, t) => s + t.amount, 0);
  const itGap = itLiability - itPaid;

  if (itGap > 1000) {
    untraced.push({
      type: 'tax_gap',
      severity: itGap > 100000 ? 'high' : 'medium',
      amount: itGap,
      description: `Income tax gap: Liability ${formatCurrency(itLiability)} but paid ${formatCurrency(itPaid)}. Outstanding: ${formatCurrency(itGap)}.`,
      recommendation: 'Verify if self-assessment tax or advance tax payments were made to cover this gap.',
    });
  }

  return untraced.sort((a, b) => b.amount - a.amount);
}

// ============================================================
// Monthly Trends
// ============================================================

function buildMonthlyTrends(entries: MoneyEntry[], taxEntries: TaxEntry[]): MonthlyData[] {
  const months: Record<string, MonthlyData> = {};

  for (const e of entries) {
    const monthKey = e.date ? e.date.slice(0, 7) : 'Unknown';
    if (!months[monthKey]) months[monthKey] = { month: monthKey, revenue: 0, expenses: 0, profit: 0, taxPaid: 0 };
    if (e.type === 'inflow') months[monthKey].revenue += e.amount;
    else months[monthKey].expenses += e.amount;
  }

  for (const t of taxEntries) {
    if (t.type === 'gst_paid' || t.type === 'tds_deposited') {
      const key = 'Unknown';
      if (!months[key]) months[key] = { month: key, revenue: 0, expenses: 0, profit: 0, taxPaid: 0 };
      months[key].taxPaid += t.amount;
    }
  }

  const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  for (const m of sorted) m.profit = m.revenue - m.expenses;
  return sorted;
}

// ============================================================
// AI Insights
// ============================================================

async function generateAIFinancialInsights(data: any): Promise<{ insights: string[]; warnings: string[]; recommendations: string[] }> {
  const llm = new ChatOpenAI({ openAIApiKey: config.openai.apiKey, modelName: 'gpt-4o-mini', temperature: 0.1 });

  const docSummaries = data.documents.slice(0, 10).map((d: any) => {
    const text = (data.chunksByDoc[d.id] || []).join('\n').slice(0, 500);
    return `${d.filename}: ${d.summary || text.slice(0, 200)}`;
  }).join('\n');

  const prompt = `You are Aegis AI acting as a senior Chartered Accountant reviewing vendor "${data.vendorName}" financials.

Financial Summary:
- Total Revenue: ₹${data.totalRevenue.toLocaleString()}
- Total Expenses: ₹${data.totalExpenses.toLocaleString()}
- Gross Profit: ₹${data.grossProfit.toLocaleString()} (${data.profitMargin}% margin)
- Net Profit: ₹${data.netProfit.toLocaleString()}
- Untraced Amount: ₹${data.totalUntracedAmount.toLocaleString()}
- Tax Gap: ₹${data.taxGap.toLocaleString()}
- Untraced Items: ${data.untracedItems.length}

Revenue Breakdown: ${JSON.stringify(data.revenueBreakdown.slice(0, 5))}
Expense Breakdown: ${JSON.stringify(data.expenseBreakdown.slice(0, 5))}
Monthly Trend: ${JSON.stringify(data.monthlyData.slice(0, 6))}

Documents:
${docSummaries}

Provide a JSON object with:
- "insights": array of 3-5 key financial insights (e.g., profit trends, revenue concentration)
- "warnings": array of 2-4 financial warnings/risks (e.g., cash flow issues, tax gaps)
- "recommendations": array of 3-5 actionable recommendations

Return ONLY valid JSON.`;

  const resp = await llm.invoke(prompt);
  const content = typeof resp.content === 'string' ? resp.content : JSON.stringify(resp.content);

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { insights: [], warnings: [], recommendations: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    };
  } catch {
    return { insights: [], warnings: [], recommendations: [] };
  }
}

function generateRuleBasedInsights(revenue: number, expenses: number, profit: number, margin: number, untraced: number, taxGap: number, untracedCount: number, docCount: number): string[] {
  const insights: string[] = [];
  if (revenue > 0) insights.push(`Total documented revenue is ${formatCurrency(revenue)} across ${docCount} documents.`);
  if (profit > 0) insights.push(`Vendor shows a gross profit of ${formatCurrency(profit)} with ${margin}% margin.`);
  else if (profit < 0) insights.push(`Vendor shows a net loss of ${formatCurrency(Math.abs(profit))}. Expenses exceed revenue.`);
  if (untraced > 0) insights.push(`${formatCurrency(untraced)} in transactions (${untracedCount} items) could not be traced to matching documents.`);
  if (taxGap > 0) insights.push(`Tax gap of ${formatCurrency(taxGap)} detected between liability and payments.`);
  if (docCount < 3) insights.push(`Only ${docCount} document(s) analyzed. More documents would improve analysis accuracy.`);
  return insights;
}

function buildFinancialSummary(name: string, revenue: number, expenses: number, grossProfit: number, netProfit: number, margin: number, untraced: number, taxGap: number, untracedCount: number, docCount: number): string {
  const parts = [`Vendor "${name}": ${docCount} documents analyzed.`];
  parts.push(`Revenue: ${formatCurrency(revenue)}, Expenses: ${formatCurrency(expenses)}.`);
  parts.push(`Gross Profit: ${formatCurrency(grossProfit)} (${margin}% margin).`);
  if (untraced > 0) parts.push(`${formatCurrency(untraced)} untraced across ${untracedCount} items.`);
  if (taxGap > 0) parts.push(`Tax gap: ${formatCurrency(taxGap)}.`);
  return parts.join(' ');
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}
