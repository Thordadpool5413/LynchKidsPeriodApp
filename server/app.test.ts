import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './app';

describe('Glitter API', () => {
  it('reports a healthy development service without claiming a database', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('glitter-api');
    expect(response.body.askBloomMode).toBe('curated');
  });

  it('serves the reviewed content catalog without authentication', async () => {
    const response = await request(app).get('/v1/content');
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(3);
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
