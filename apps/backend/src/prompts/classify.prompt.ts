export function createClassificationPrompt(text: string): string {
  return `Analyze the following document text and classify its risk level. Return a JSON object with the following structure:

{
  "riskLevel": "Critical" | "Warning" | "Normal",
  "riskCategory": "Legal" | "Financial" | "Compliance" | "Operational" | "None",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of why this risk level was assigned (2-3 sentences)",
  "recommendations": ["Action item 1", "Action item 2", "Action item 3"]
}

Classification criteria:
- Critical: Contains sensitive information (PII, financial data, security credentials), legal issues, compliance violations, or high-risk content
- Warning: Contains moderate risk content, warnings, cautions, or requires attention but not immediately critical
- Normal: Standard business content, general information, low-risk documentation

Risk Categories:
- Legal: Contracts, NDAs, legal agreements, liability clauses, termination terms
- Financial: Financial statements, payment terms, pricing, revenue data, bank details
- Compliance: Regulatory requirements, GDPR, HIPAA, SOX, audit trails
- Operational: Security policies, access controls, procedures, system configurations
- None: No specific risk category applies

Confidence: A number between 0.0 and 1.0 indicating how confident you are in this classification (0.95 = 95% confident).

Recommendations should be specific, actionable steps the user should take based on the risk level:
- For Critical: Immediate actions like "Review access controls", "Encrypt sensitive data", "Notify compliance team"
- For Warning: Preventive actions like "Schedule review", "Update documentation", "Monitor usage"
- For Normal: Best practices like "Regular backups", "Version control", "Access logging"

Document text (first 3000 characters):
${text.substring(0, 3000)}

Respond with ONLY valid JSON, no additional text:`;
}
