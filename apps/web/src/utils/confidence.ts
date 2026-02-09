/**
 * Format confidence for display. Ensures we show "95%" not "0.95%".
 * Accepts either 0-1 (decimal) or 0-100 (percentage) from the API.
 */
export function formatConfidence(value: number | undefined | null): string {
  if (value == null) return '';
  const pct = typeof value === 'number' && value <= 1
    ? Math.round(value * 100)
    : Math.round(value);
  return `${Math.min(100, Math.max(0, pct))}%`;
}
