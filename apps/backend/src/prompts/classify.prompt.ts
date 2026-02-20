export function createClassificationPrompt(text: string): string {
  return `Analyze the following document text and classify its risk level. Return a JSON object with the following structure:

{
  "riskLevel": "Critical" | "Warning" | "Normal",
  "riskCategory": "Legal" | "Financial" | "Compliance" | "Operational" | "None",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of why this risk level was assigned (2-3 sentences)",
  "recommendations": ["Action item 1", "Action item 2", "Action item 3"]
}

IMPORTANT — DOCUMENT TYPE CONTEXT:
First identify the document type. Standard business/vendor documents should be classified based on their CONTENT QUALITY, not just the presence of sensitive data:

- Cancelled Cheque: A standard bank verification document. Having bank details is EXPECTED and normal — classify as "Normal" unless the cheque appears tampered or inconsistent.
- PAN Card: A standard identity document. Having PAN number is EXPECTED — classify as "Normal" unless data looks inconsistent.
- KYC / Vendor Registration Form: Standard onboarding document — classify as "Normal" unless information is incomplete or suspicious.
- Certificate of Incorporation / GST Certificate: Standard registration documents — classify as "Normal".
- Bank Statement: Financial document — "Normal" if complete, "Warning" if data gaps exist.
- P&L / Balance Sheet: Financial document — "Normal" if audited/complete, "Warning" if inconsistencies found.
- Invoice: Financial document — "Warning" if amounts/dates mismatch, "Normal" if complete.
- ITR: Tax document — "Normal" if filed and verified, "Warning" if discrepancies.
- Auditor's Report: Professional opinion — "Normal" if unqualified, "Warning" if qualified.

Classification criteria:
- Critical: Actual fraud indicators (tampered documents, forged signatures), major compliance violations, or genuinely suspicious content. NOT just because a document contains PII or bank details (those are expected in business documents).
- Warning: Incomplete data that should be present for that document type, minor inconsistencies, qualified audit opinions, or documents requiring follow-up.
- Normal: Standard business documents with expected information present and consistent.

Risk Categories:
- Legal: Contracts, NDAs, legal agreements, liability clauses, termination terms
- Financial: Financial statements, payment terms, pricing, revenue data
- Compliance: Regulatory requirements, tax filing, audit trails
- Operational: Business processes, verification documents
- None: Standard documents with no specific risk

Recommendations should be contextually appropriate:
- For a Cancelled Cheque: "Verify account details match vendor records" (not "Encrypt sensitive data")
- For a PAN Card: "Cross-verify PAN with GSTIN records" (not "Notify compliance team")
- For Financial Documents: Relevant financial checks

Document text (first 3000 characters):
${text.substring(0, 3000)}

Respond with ONLY valid JSON, no additional text:`;
}
