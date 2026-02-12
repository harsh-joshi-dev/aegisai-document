/**
 * India: INR currency formatting (lakhs/crores notation)
 * e.g. ₹1,50,000 (not $150,000)
 */
export function formatINR(value: number, options?: { compact?: boolean }): string {
  if (options?.compact && value >= 1_00_000) {
    if (value >= 1_00_00_000) {
      return `₹${(value / 1_00_00_000).toFixed(1)} Cr`;
    }
    return `₹${(value / 1_00_000).toFixed(1)} L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Indian date format DD/MM/YYYY
 */
export function formatDateIN(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
