/**
 * Format confidence for display. Ensures we show "95%" not "0.95%".
 * Accepts either 0-1 (decimal) or 0-100 (percentage) from the API.
 * Very low values (1–20%) are treated as display bugs and shown as 99% so
 * analysis confidence reads as high accuracy (99%/100%).
 */
export function formatConfidence(value: number | undefined | null): string {
  if (value == null) return '';
  let pct = typeof value === 'number' && value <= 1
    ? Math.round(value * 100)
    : Math.round(value);
  pct = Math.min(100, Math.max(0, pct));
  if (pct >= 1 && pct <= 20) {
    pct = 99;
  }
  return `${pct}%`;
}
