/**
 * ULI OAuth 2.0 + client certificate authentication
 * Sandbox/production token acquisition
 */
import crypto from 'crypto';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getConfig() {
  const baseUrl = process.env.ULI_BASE_URL || 'https://sandbox.uli.org.in';
  const tokenUrl = process.env.ULI_TOKEN_URL || `${baseUrl}/oauth/token`;
  return {
    clientId: process.env.ULI_CLIENT_ID || '',
    clientSecret: process.env.ULI_CLIENT_SECRET || '',
    baseUrl,
    tokenUrl,
    clientCertPath: process.env.ULI_CLIENT_CERT_PATH,
    clientKeyPath: process.env.ULI_CLIENT_KEY_PATH,
  };
}

/**
 * Acquire OAuth2 access token (client credentials).
 * In production, mTLS would be used with client cert/key.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const cfg = getConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    // Sandbox: return a placeholder token for development
    const placeholder = `sandbox_${crypto.randomBytes(16).toString('hex')}`;
    cachedToken = { token: placeholder, expiresAt: Date.now() + 3600_000 };
    return placeholder;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  };
  const res = await fetch(cfg.tokenUrl, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ULI token request failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export function clearTokenCache(): void {
  cachedToken = null;
}
