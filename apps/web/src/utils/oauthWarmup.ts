type WarmupOptions = {
  onStatus?: (message: string) => void;
  maxAttempts?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getBackendOrigin(): string {
  const backendOriginRaw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
  return String(backendOriginRaw).replace(/\/$/, '');
}

async function pingBackendHealth(backendOrigin: string, timeoutMs: number): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    // no-cors allows best-effort pings even if health endpoint lacks CORS headers.
    await fetch(`${backendOrigin}/health`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function warmBackendAndRedirectToGoogle({
  onStatus,
  maxAttempts = 3,
}: WarmupOptions = {}): Promise<void> {
  const backendOrigin = getBackendOrigin();
  const attempts = Math.max(1, maxAttempts);

  onStatus?.('Waking backend...');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pingBackendHealth(backendOrigin, 4500);
      break;
    } catch {
      if (attempt < attempts) {
        onStatus?.(`Waking backend... (${attempt + 1}/${attempts})`);
        await sleep(1400 * attempt);
      }
    }
  }

  onStatus?.('Redirecting to Google...');
  window.location.href = `${backendOrigin}/api/auth/google`;
}
