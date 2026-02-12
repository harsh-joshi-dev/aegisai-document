/**
 * ULI API rate limiter: max 100 calls per minute per client
 */
const MAX_CALLS_PER_MINUTE = 100;

const timestamps: number[] = [];

function prune(): void {
  const oneMinuteAgo = Date.now() - 60_000;
  while (timestamps.length > 0 && timestamps[0]! < oneMinuteAgo) {
    timestamps.shift();
  }
}

export function checkRateLimit(): boolean {
  prune();
  return timestamps.length < MAX_CALLS_PER_MINUTE;
}

export function recordCall(): void {
  prune();
  timestamps.push(Date.now());
}

export function getRemainingCalls(): number {
  prune();
  return Math.max(0, MAX_CALLS_PER_MINUTE - timestamps.length);
}
