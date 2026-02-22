export function createClassificationPrompt(text: string): string {
  const docLength = text.length;
  const truncatedText = text.substring(0, 6000);

  return `You are an expert financial document risk analyst. Analyze the following document thoroughly and return a JSON classification.

RESPONSE FORMAT (strict JSON only):
{
  "riskLevel": "Critical" | "Warning" | "Normal",
  "riskCategory": "Legal" | "Financial" | "Compliance" | "Operational" | "None",
  "confidence": 0.0-1.0,
  "explanation": "Detailed explanation of risk assessment (3-5 sentences covering what the document is, what was found, and why the risk level is assigned)",
  "recommendations": ["Specific action item 1", "Specific action item 2", "Specific action item 3"],
  "documentType": "The detected document type (e.g., Invoice, Bank Statement, PAN Card, GST Return, Contract, etc.)",
  "keyFindings": ["Finding 1", "Finding 2"]
}

DOCUMENT TYPE CLASSIFICATION — first identify what this document is:
- Cancelled Cheque → bank verification doc, PII is EXPECTED → "Normal" unless tampered
- PAN Card / Aadhaar → identity document, PII is EXPECTED → "Normal" unless data inconsistent
- KYC / Vendor Registration → onboarding form → "Normal" unless incomplete
- Certificate of Incorporation / GST Certificate → registration → "Normal"
- Bank Statement → "Normal" if complete; "Warning" if gaps, unusual transactions, or periods missing
- P&L / Balance Sheet → "Normal" if audited; "Warning" if inconsistencies or unaudited
- Invoice → "Normal" if amounts/dates/GST consistent; "Warning" if mismatches
- ITR → "Normal" if filed and complete; "Warning" if discrepancies in income/tax figures
- Contract / Agreement → check for unfavorable terms, missing clauses, unlimited liability
- Credit Note → verify against original invoice, check for round-amount adjustments
- Salary Slip → verify components match statutory requirements

RISK LEVEL CRITERIA:
- Critical: Fraud indicators (forged signatures, tampered amounts, duplicate invoices with different amounts), major compliance violations, documents with severe legal liability, or genuinely suspicious patterns. NOT merely because PII exists.
- Warning: Missing mandatory fields for that document type, minor data inconsistencies, qualified audit opinions, amounts that don't reconcile, expired documents, or items needing follow-up verification.
- Normal: Standard documents with expected information present, internally consistent data, and no red flags.

RISK CATEGORIES:
- Legal: Contracts, NDAs, agreements, liability, termination, dispute-related
- Financial: Statements, invoices, payment terms, revenue/expense data, tax documents
- Compliance: GST returns, regulatory filings, audit reports, certification documents
- Operational: Vendor KYC, process documents, internal forms
- None: Standard documents with no elevated risk

ACCURACY REQUIREMENTS:
- Read the ENTIRE document text carefully before classifying
- Cross-check numbers: do line items sum to totals? Does CGST+SGST=Total GST?
- Check dates: are they in valid ranges? Is invoice date before due date?
- Check for completeness: are all required fields present for this document type?
- Confidence should reflect your actual certainty (0.5 = uncertain, 0.9+ = very sure)

Document text (${docLength} total characters, showing first 6000):
${truncatedText}

Respond with ONLY valid JSON, no additional text:`;
}
