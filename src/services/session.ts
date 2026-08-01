/**
 * Dev-mode parent session token helper.
 * In production this will be replaced by the verified parent auth flow.
 * The token persists across Stripe redirects so the entitlement refresh
 * after checkout=success can reuse the same session.
 */

const PARENT_TOKEN_KEY = 'glitter.parent-token.v1';

const apiUrl = (() => {
  const raw = (process.env.EXPO_OS === 'web'
    ? process.env.EXPO_PUBLIC_API_URL ?? ''
    : process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  return raw;
})();

export function getStoredParentToken(): string | null {
  try {
    return localStorage.getItem(PARENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeParentToken(token: string): void {
  try {
    localStorage.setItem(PARENT_TOKEN_KEY, token);
  } catch {}
}

/**
 * Returns the cached parent dev-session token, or requests a fresh one.
 * Throws if the dev-session endpoint is unavailable (e.g. production).
 */
export async function getOrCreateDevParentToken(): Promise<string> {
  const stored = getStoredParentToken();
  if (stored) return stored;
  const response = await fetch(`${apiUrl}/v1/dev/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'parent' }),
  });
  if (!response.ok) throw new Error('Preview session unavailable — checkout requires production credentials.');
  const body = await response.json() as { token: string };
  storeParentToken(body.token);
  return body.token;
}
