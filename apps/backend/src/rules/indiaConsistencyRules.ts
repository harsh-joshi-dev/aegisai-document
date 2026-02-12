/**
 * India SME Lending - Consistency check rules
 * Revenue mismatch (GST vs ITR), employment continuity, address verification, bank velocity
 */
export interface RiskFlag {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  rule: string;
}

/** Input for consistency rules; fetchedAt optional when passed from API. */
export interface ConsistencyInput {
  gstReturns?: Array<{ type: 'GSTR-1' | 'GSTR-3B'; period: string; taxableValue?: number; taxAmount?: number; fetchedAt?: string }>;
  itrForms?: Array<{ type: 'ITR-V' | 'Form 16'; assessmentYear: string; grossReceipts?: number; fetchedAt?: string }>;
  bankStatements?: Array<{
    accountId: string;
    fromDate: string;
    toDate: string;
    transactions: Array<{ date: string; description: string; amount: number; type: 'credit' | 'debit' }>;
    fetchedAt?: string;
  }>;
  aadhaarXml?: { maskedUid: string; addressLine1?: string; state?: string; pincode?: string; fetchedAt?: string };
}

const REVENUE_MISMATCH_THRESHOLD_PCT = 10;

/**
 * Revenue Mismatch Rule: Flag if GST taxable value differs from ITR gross receipts by >10%
 */
export function revenueMismatchRule(
  gst: ConsistencyInput['gstReturns'],
  itr: ConsistencyInput['itrForms']
): RiskFlag[] {
  const gstList = gst ?? [];
  const itrList = itr ?? [];
  const flags: RiskFlag[] = [];
  if (!gstList.length || !itrList.length) return flags;
  const gstTaxable = gstList.reduce((sum, d) => sum + (d.taxableValue ?? 0), 0);
  const itrGross = itrList.reduce((sum, d) => sum + (d.grossReceipts ?? 0), 0);
  if (gstTaxable === 0 && itrGross === 0) return flags;
  const max = Math.max(gstTaxable, itrGross);
  const min = Math.min(gstTaxable, itrGross);
  if (max === 0) return flags;
  const pctDiff = ((max - min) / max) * 100;
  if (pctDiff > REVENUE_MISMATCH_THRESHOLD_PCT) {
    flags.push({
      code: 'REVENUE_MISMATCH',
      severity: pctDiff > 30 ? 'high' : 'medium',
      message: `GST taxable value (₹${formatINR(gstTaxable)}) differs from ITR gross receipts (₹${formatINR(itrGross)}) by ${pctDiff.toFixed(1)}%. Threshold: ${REVENUE_MISMATCH_THRESHOLD_PCT}%.`,
      rule: 'Revenue Mismatch Rule',
    });
  }
  return flags;
}

/**
 * Employment Continuity Rule: Cross-check Form 16 dates with bank salary credit regularity
 */
export function employmentContinuityRule(
  itr: ConsistencyInput['itrForms'],
  bank: ConsistencyInput['bankStatements']
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const itrList = itr ?? [];
  const bankList = bank ?? [];
  const form16 = itrList.filter((d) => d.type === 'Form 16');
  if (!form16.length || !bankList.length) return flags;
  const salaryCredits = bankList.flatMap((s) =>
    s.transactions.filter(
      (t) =>
        t.type === 'credit' &&
        (t.description.toUpperCase().includes('SALARY') ||
          t.description.toUpperCase().includes('SAL'))
    )
  );
  if (salaryCredits.length === 0) {
    flags.push({
      code: 'NO_SALARY_CREDITS',
      severity: 'medium',
      message: 'No salary credits found in bank statements; Form 16 present. Verify employment continuity.',
      rule: 'Employment Continuity Rule',
    });
  }
  return flags;
}

/**
 * Address Verification Rule: Compare Aadhaar address vs GST registration address
 * (We don't have GST address in current type; flag if Aadhaar missing when GST present.)
 */
export function addressVerificationRule(
  aadhaar: ConsistencyInput['aadhaarXml'],
  gst: ConsistencyInput['gstReturns']
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const gstList = gst ?? [];
  if (gstList.length > 0 && !aadhaar?.state) {
    flags.push({
      code: 'ADDRESS_VERIFICATION_INCOMPLETE',
      severity: 'low',
      message: 'Aadhaar address not available for cross-verification with GST registration address.',
      rule: 'Address Verification Rule',
    });
  }
  return flags;
}

/**
 * Bank Statement Velocity Rule: Detect sudden large credits before loan application (risk indicator)
 */
export function bankVelocityRule(bank: ConsistencyInput['bankStatements']): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const bankList = bank ?? [];
  for (const st of bankList) {
    const credits = st.transactions.filter((t) => t.type === 'credit');
    if (credits.length < 2) continue;
    const sorted = [...credits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const recent = sorted.slice(0, 3);
    const older = sorted.slice(3, 6);
    const recentAvg = recent.length ? recent.reduce((s, t) => s + t.amount, 0) / recent.length : 0;
    const olderAvg = older.length ? older.reduce((s, t) => s + t.amount, 0) / older.length : 0;
    if (olderAvg > 0 && recentAvg > olderAvg * 2) {
      flags.push({
        code: 'BANK_VELOCITY_SPIKE',
        severity: 'medium',
        message: `Recent credit average (₹${formatINR(recentAvg)}) is >2x older period (₹${formatINR(olderAvg)}). Possible one-time inflow before application.`,
        rule: 'Bank Statement Velocity Rule',
      });
    }
  }
  return flags;
}

export function runAllConsistencyRules(input: ConsistencyInput): {
  riskFlags: RiskFlag[];
  consistencyScore: number;
} {
  const allFlags: RiskFlag[] = [];
  allFlags.push(...revenueMismatchRule(input.gstReturns ?? [], input.itrForms ?? []));
  allFlags.push(
    ...employmentContinuityRule(input.itrForms ?? [], input.bankStatements ?? [])
  );
  allFlags.push(
    ...addressVerificationRule(input.aadhaarXml, input.gstReturns ?? [])
  );
  allFlags.push(...bankVelocityRule(input.bankStatements ?? []));

  const critical = allFlags.filter((f) => f.severity === 'critical').length;
  const high = allFlags.filter((f) => f.severity === 'high').length;
  const medium = allFlags.filter((f) => f.severity === 'medium').length;
  const low = allFlags.filter((f) => f.severity === 'low').length;
  const deduction = critical * 25 + high * 15 + medium * 8 + low * 3;
  const consistencyScore = Math.max(0, Math.min(100, 100 - deduction));

  return { riskFlags: allFlags, consistencyScore };
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}
