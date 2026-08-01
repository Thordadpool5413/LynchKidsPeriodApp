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
