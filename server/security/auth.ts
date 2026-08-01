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
