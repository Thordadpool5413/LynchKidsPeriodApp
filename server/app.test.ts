import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app, serveContent } from './app';
import { filterPublished } from '../shared/content';
import type { ContentItem } from '../shared/types';
import { PENDING_CONTENT } from './pending-content';

// Synthetic fixtures for non-vacuous mixed-catalog tests.
const reviewedFixture: ContentItem = {
  id: 'test-reviewed', slug: 'test-reviewed', title: 'Reviewed article',
  summary: 'Approved by a clinician', body: 'Verified safe content about periods.',
  category: 'basics', premium: false,
  reviewedAt: '2026-08-01', reviewerStatus: 'clinician-reviewed', publishedAt: '2026-08-01',
};

const draftFixture: ContentItem = {
  id: 'test-draft', slug: 'test-draft', title: 'Draft article',
  summary: 'Pending review', body: 'This has not been reviewed yet.',
  category: 'basics', premium: false,
  reviewedAt: '2026-08-01', reviewerStatus: 'draft', publishedAt: '2026-08-01',
};

describe('Glitter API', () => {
  it('reports a healthy development service without claiming a database', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('glitter-api');
    expect(response.body.askBloomMode).toBe('curated');
  });

  it('serves the content catalog without authentication and never includes draft items', async () => {
    const response = await request(app).get('/v1/content');
    expect(response.status).toBe(200);
    const drafts = (response.body.items as Array<{ reviewerStatus: string }>).filter(
      (item) => item.reviewerStatus === 'draft'
    );
    expect(drafts).toHaveLength(0);
  });

  it('filterPublished excludes draft items and retains reviewed items from a mixed catalog', () => {
    const mixed = [reviewedFixture, draftFixture];
    const published = filterPublished(mixed);
    expect(published).toHaveLength(1);
    expect(published[0].id).toBe('test-reviewed');
    expect(published.find((item) => item.id === 'test-draft')).toBeUndefined();
  });

  it('content endpoint serves reviewed items and excludes drafts when given a mixed catalog', async () => {
    // Inject a catalog with one reviewed and one draft item into the route handler.
    const testApp = express();
    testApp.get('/v1/content', serveContent(filterPublished([reviewedFixture, draftFixture])));
    const response = await request(testApp).get('/v1/content');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe('test-reviewed');
    const drafts = (response.body.items as Array<{ reviewerStatus: string }>).filter(
      (item) => item.reviewerStatus === 'draft'
    );
    expect(drafts).toHaveLength(0);
  });

  it('pending content items are all draft and not served publicly', () => {
    // Proves that the pending catalog contains only draft items —
    // none of which would pass filterPublished.
    for (const item of PENDING_CONTENT) {
      expect(item.reviewerStatus).toBe('draft');
    }
    expect(filterPublished(PENDING_CONTENT)).toHaveLength(0);
  });

  it('does not surface draft content in Ask Glitter curated answers', async () => {
    const session = await request(app).post('/v1/dev/session').send({ role: 'child' });
    const response = await request(app)
      .post('/v1/ask-bloom')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ question: 'cramps period pads' });
    expect(response.status).toBe(200);
    if (Array.isArray(response.body.items)) {
      for (const item of response.body.items as Array<{ reviewerStatus: string }>) {
        expect(item.reviewerStatus).toBe('clinician-reviewed');
      }
    }
  });

  it('does not reveal whether an email account exists', async () => {
    const response = await request(app).post('/v1/auth/request-link').send({ email: 'parent@example.com' });
    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(true);
  });

  it('returns 503 and never logs a token when acting as production without SMTP configured', async () => {
    // Simulate a production environment with no SMTP transport.
    const { config } = await import('./config');
    const originalEnv = config.NODE_ENV;
    (config as any).NODE_ENV = 'production';

    const loggedLines: string[] = [];
    const originalLog = console.info;
    console.info = (...args: unknown[]) => { loggedLines.push(args.join(' ')); };

    try {
      const response = await request(app).post('/v1/auth/request-link').send({ email: 'attacker@example.com' });
      // Must not succeed — delivery is impossible without SMTP in production.
      expect(response.status).toBe(503);
      // Response body must never contain a token or the link.
      const body = JSON.stringify(response.body);
      expect(body).not.toContain('magic');
      expect(body).not.toContain('token');
      // No link or email address must have been written to the log.
      const logged = loggedLines.join('\n');
      expect(logged).not.toContain('attacker@example.com');
      expect(logged).not.toContain('magic');
    } finally {
      (config as any).NODE_ENV = originalEnv;
      console.info = originalLog;
    }
  });

  it('rejects a magic-link verify request with a missing or malformed token', async () => {
    const missingToken = await request(app).get('/v1/auth/verify-link');
    expect(missingToken.status).toBe(400);

    const badToken = await request(app).get('/v1/auth/verify-link?token=not.a.valid.token');
    expect(badToken.status).toBe(401);
  });

  it('issues a real parent session token after verifying a valid magic link', async () => {
    // Step 1: Request a magic link. The server logs the link to stdout in dev (no SMTP).
    const linkRequest = await request(app).post('/v1/auth/request-link').send({ email: 'test-parent@example.com' });
    expect(linkRequest.status).toBe(202);

    // Step 2: Generate a valid magic token directly (mirrors what the server embeds in the link).
    const { createMagicLinkToken } = await import('./security/auth');
    const magicToken = createMagicLinkToken('test-parent@example.com');

    // Step 3: Verify the token and receive a session.
    const verifyResponse = await request(app).get(`/v1/auth/verify-link?token=${encodeURIComponent(magicToken)}`);
    expect(verifyResponse.status).toBe(200);
    expect(typeof verifyResponse.body.token).toBe('string');
    expect(typeof verifyResponse.body.parentAccountId).toBe('string');

    // Step 4: The returned session token must work for authenticated endpoints.
    const entitlementResponse = await request(app)
      .get('/v1/entitlement')
      .set('Authorization', `Bearer ${verifyResponse.body.token}`);
    expect(entitlementResponse.status).toBe(200);
    expect(entitlementResponse.body.entitlement.status).toBe('free');
  });

  it('requires authentication for Ask Glitter', async () => {
    const response = await request(app).post('/v1/ask-bloom').send({ question: 'Are cramps normal?' });
    expect(response.status).toBe(401);
  });

  it('returns fixed urgent guidance instead of a generated answer', async () => {
    const session = await request(app).post('/v1/dev/session').send({ role: 'child' });
    const response = await request(app)
      .post('/v1/ask-bloom')
      .set('Authorization', `Bearer ${session.body.token}`)
      .send({ question: 'I fainted and I am scared' });
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('fixed-safety');
    expect(response.body.safety).toBe('urgent');
  });
});
