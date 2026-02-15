import { getDocuments, getVendorMemory, insertPatternEvent, upsertDocumentInsights, upsertVendorMemory } from '../db/pgvector.js';

function toNumber(n: unknown): number | null {
  const v = typeof n === 'number' ? n : n == null ? null : Number(n);
  return v != null && Number.isFinite(v) ? v : null;
}

function vendorKeyFromExtracted(extracted: any): { vendorKey: string | null; vendorName: string | null; vendorGstin: string | null } {
  const vendorGstin = (extracted?.vendorGstin as string | undefined)?.trim() || null;
  const vendorName = (extracted?.vendorName as string | undefined)?.trim() || null;
  const vendorKey = vendorGstin || vendorName || null;
  return { vendorKey, vendorName, vendorGstin };
}

export async function computeAndPersistInsights(params: { tenantId: string; actorUserId: string; documentId: string }): Promise<void> {
  const { tenantId, actorUserId, documentId } = params;

  const docs = await getDocuments({ tenantId, documentIds: [documentId] });
  const doc = docs[0] as any;
  if (!doc) return;

  const extracted = doc.extracted_data || {};
  const amount = toNumber(extracted?.totalAmount) ?? toNumber(extracted?.amount) ?? null;
  const { vendorKey, vendorName, vendorGstin } = vendorKeyFromExtracted(extracted);

  const riskReasons: Record<string, unknown> = {};
  const recommendations: string[] = [];
  const patterns: Record<string, unknown> = {};

  let consistencyScore: number | null = 100;
  const missing: string[] = [];
  if (!vendorKey) missing.push('vendor');
  if (!extracted?.invoiceNumber) missing.push('invoiceNumber');
  if (!extracted?.invoiceDate) missing.push('invoiceDate');
  if (!extracted?.vendorGstin) missing.push('vendorGstin');
  if (amount == null) missing.push('amount');

  if (missing.length > 0) {
    consistencyScore = Math.max(0, 100 - missing.length * 12);
    riskReasons.missingFields = missing;
    recommendations.push('Fill or verify missing invoice fields before approval.');
  }

  if (amount != null && vendorKey) {
    const memory = await getVendorMemory({ tenantId, vendorKey });

    if (memory && memory.count >= 5 && memory.meanAmount != null && memory.m2Amount != null) {
      const variance = memory.count > 1 ? memory.m2Amount / (memory.count - 1) : 0;
      const stddev = Math.sqrt(Math.max(0, variance));
      const z = stddev > 0 ? (amount - memory.meanAmount) / stddev : 0;

      if (z >= 3) {
        patterns.unusualVendorAmount = {
          amount,
          mean: memory.meanAmount,
          stddev,
          z,
        };
        riskReasons.vendorAmountAnomaly = patterns.unusualVendorAmount;
        recommendations.push('Verify the billed amount against the PO/contract and payment terms.');

        await insertPatternEvent({
          tenantId,
          actorUserId,
          documentId,
          vendorKey,
          eventType: 'VENDOR_AMOUNT_SPIKE',
          severity: z >= 4 ? 'HIGH' : 'MEDIUM',
          title: 'Unusual transaction detected',
          details: patterns.unusualVendorAmount as any,
        });
      }
    }

    await upsertVendorMemory({
      tenantId,
      actorUserId,
      vendorKey,
      vendorName,
      vendorGstin,
      amount,
    });
  }

  if (!extracted?.vendorGstin) {
    riskReasons.gstinMissing = true;
    recommendations.push('Verify vendor GSTIN and GST filing if applicable.');
    consistencyScore = Math.max(0, (consistencyScore ?? 100) - 10);
  }

  const derivedRiskScore = typeof doc.risk_score === 'number' ? doc.risk_score : null;

  await upsertDocumentInsights({
    tenantId,
    actorUserId,
    documentId,
    vendorKey,
    consistencyScore,
    riskScore: derivedRiskScore,
    riskReasons,
    recommendations,
    patterns,
  });
}
