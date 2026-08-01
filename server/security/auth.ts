import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export interface SessionClaims { subject: string; role: 'parent' | 'child'; childId?: string; expiresAt: number }

function secret(): string {
  return config.SESSION_SECRET ?? 'development-only-secret-do-not-use-000000';
}

export function createSessionToken(claims: Omit<SessionClaims, 'expiresAt'>, ttlSeconds = 3600): string {
  const payload = Buffer.from(JSON.stringify({ ...claims, expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Creates a short-lived signed token embedding an email address for magic-link sign-in. */
export function createMagicLinkToken(email: string, ttlSeconds = 900): string {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  // Use a distinct prefix so magic tokens cannot be replayed as session tokens.
  const signature = createHmac('sha256', secret()).update(`magic.${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * In-memory store of already-consumed magic-link token payloads.
 * Maps payload → expiresAt (unix seconds) so expired entries can be pruned.
 * A restart clears the store, but tokens also expire in 15 minutes so the
 * window for replay after a restart is negligible.
 */
const usedMagicPayloads = new Map<string, number>();

function pruneUsedMagicPayloads(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, exp] of usedMagicPayloads) {
    if (exp < now) usedMagicPayloads.delete(key);
  }
}

/** Verifies a magic-link token. Returns the embedded email, or null if invalid/expired. */
export function verifyMagicLinkToken(token: string): { email: string } | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret()).update(`magic.${payload}`).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email: string; expiresAt: number };
    return claims.expiresAt > Math.floor(Date.now() / 1000) ? { email: claims.email } : null;
  } catch {
    return null;
  }
}

/**
 * Like verifyMagicLinkToken but also enforces single-use: returns null and refuses
 * the token if it has already been consumed, even if it hasn't expired yet.
 */
export function consumeMagicLinkToken(token: string): { email: string } | null {
  const parts = token.split('.');
  const payload = parts[0];
  if (!payload) return null;

  pruneUsedMagicPayloads();

  if (usedMagicPayloads.has(payload)) return null;

  const result = verifyMagicLinkToken(token);
  if (!result) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expiresAt: number };
    usedMagicPayloads.set(payload, claims.expiresAt);
  } catch {
    usedMagicPayloads.set(payload, Math.floor(Date.now() / 1000) + 900);
  }

  return result;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
  return claims.expiresAt > Math.floor(Date.now() / 1000) ? claims : null;
}

declare global { namespace Express { interface Request { session?: SessionClaims } } }

export function requireSession(role?: SessionClaims['role']) {
  return (request: Request, response: Response, next: NextFunction) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const claims = token ? verifySessionToken(token) : null;
    if (!claims || (role && claims.role !== role)) return response.status(401).json({ error: 'Authentication required' });
    request.session = claims;
    next();
  };
}
