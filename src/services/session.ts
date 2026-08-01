/**
 * Parent session token helpers.
 *
 * Production path: magic-link sign-in (requestSignInLink → verifyAndStoreToken).
 * Dev path: /v1/dev/session (only available when NODE_ENV !== 'production').
 *
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

export function storeParentToken(token: string): void {
  try {
    localStorage.setItem(PARENT_TOKEN_KEY, token);
  } catch {}
}

export function clearParentToken(): void {
  try {
    localStorage.removeItem(PARENT_TOKEN_KEY);
  } catch {}
}

/**
 * Requests a magic sign-in link for the given email.
 * In production, the server sends an email. In dev (no SMTP), the link is logged
 * to the server console so it can be followed manually.
 */
export async function requestSignInLink(email: string): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/auth/request-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === 'string' ? body.error : 'Could not send sign-in link. Try again.');
  }
}

/**
 * Verifies a magic-link token returned from the server's /v1/auth/verify-link endpoint,
 * stores the resulting session token, and returns it.
 */
export async function verifyAndStoreToken(magicToken: string): Promise<string> {
  const response = await fetch(`${apiUrl}/v1/auth/verify-link?token=${encodeURIComponent(magicToken)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === 'string' ? body.error : 'Sign-in link is invalid or has expired.');
  }
  const body = await response.json() as { token: string };
  storeParentToken(body.token);
  return body.token;
}

/**
 * Returns the cached parent session token, or requests a fresh dev-session token
 * in non-production environments.
 *
 * Throws a descriptive error in production when no token is stored — the caller
 * should redirect the user to the sign-in flow.
 */
export async function getOrCreateDevParentToken(): Promise<string> {
  const stored = getStoredParentToken();
  if (stored) return stored;

  if (process.env.EXPO_PUBLIC_ENV === 'production') {
    throw new Error('Sign in required — please enter your email to get a sign-in link.');
  }

  // Dev-only fallback: mint a synthetic session token directly.
  const response = await fetch(`${apiUrl}/v1/dev/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'parent' }),
  });
  if (!response.ok) throw new Error('Sign in required — please enter your email to get a sign-in link.');
  const devBody = await response.json() as { token: string };
  storeParentToken(devBody.token);
  return devBody.token;
}
