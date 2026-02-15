import type { Issue, Recommendation } from '../mock/types';

export function generateDocumentAnalysis(
  docType: string,
  vendor: string,
  amount: number,
  score: number,
  level: string
): { summary: string; issues: Issue[]; mismatches: Array<{ field: string; sourceA: string; sourceB: string }>; recommendations: Recommendation[] } {
  const issues: Issue[] = [];
  const mismatches: Array<{ field: string; sourceA: string; sourceB: string }> = [];
  const recommendations: Recommendation[] = [];

  let summary = 'Document analyzed successfully. ';

  if (level === 'Critical' || level === 'High') {
    summary += `Risk score ${score} indicates elevated risk. Review key mismatches and issues before approval. `;
  }

  if (amount > 50000 && docType === 'Invoice') {
    issues.push({
      id: `iss-${Date.now()}-1`,
      severity: amount > 100000 ? 'High' : 'Medium',
      title: 'High-value invoice',
      explanation: `Invoice amount ₹${amount.toLocaleString('en-IN')} exceeds typical threshold. Requires additional verification.`,
      recommendation: 'Verify vendor credentials and obtain second approval for amounts above threshold.',
    });
  }

  if (docType === 'Bank' && score > 65) {
    issues.push({
      id: `iss-${Date.now()}-2`,
      severity: 'Medium',
      title: 'Bank statement anomaly',
      explanation: 'Statement shows patterns that may require reconciliation with ledger.',
      recommendation: 'Cross-check balances with accounting system and verify transaction dates.',
    });
  }

  if (docType === 'GST') {
    mismatches.push({
      field: 'GSTIN validation',
      sourceA: vendor,
      sourceB: 'GST portal records',
    });
    summary += 'GST details should be verified against GST portal for consistency. ';
  }

  if (amount > 75000) {
    mismatches.push({
      field: 'Amount vs ledger',
      sourceA: `₹${amount.toLocaleString('en-IN')}`,
      sourceB: 'Verify against purchase order / contract',
    });
  }

  if (issues.length === 0 && mismatches.length === 0 && level !== 'Critical') {
    summary += 'No critical mismatches detected. Document appears consistent with expected format.';
  }

  if (level === 'Critical' || level === 'High') {
    recommendations.push({
      id: `rec-${Date.now()}-1`,
      text: 'Obtain supporting documents (PO, contract) before approval.',
    });
  }

  if (mismatches.length > 0) {
    recommendations.push({
      id: `rec-${Date.now()}-2`,
      text: 'Resolve detected mismatches with source systems before final approval.',
    });
  }

  if (issues.length > 0 && recommendations.length === 0) {
    recommendations.push({
      id: `rec-${Date.now()}-3`,
      text: 'Address the identified issues and re-validate document.',
    });
  }

  return { summary, issues, mismatches, recommendations };
}
