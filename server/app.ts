import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import OpenAI from 'openai';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { EDUCATION_CONTENT, findCuratedAnswer } from '../shared/content';
import { normalizeEntitlement } from '../shared/entitlements';
import { classifySafety, SAFETY_RESPONSES } from '../shared/safety';
import type { SyncMutation } from '../shared/types';
import { config } from './config';
import { db, checkDatabase } from './db/client';
import { subscriptionEntitlements, syncRecords, webhookEvents } from './db/schema';
import { createSessionToken, requireSession } from './security/auth';
import { encryptField } from './security/crypto';

const app = express();
const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;
const openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
});
app.use(cors({ origin: config.PUBLIC_APP_URL, credentials: false, methods: ['GET', 'POST', 'DELETE'] }));

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(limit: number, windowMs: number) {
  return (request: Request, response: Response, next: NextFunction) => {
    const key = `${request.ip}:${request.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
    else if (bucket.count >= limit) return response.status(429).json({ error: 'Too many requests. Try again soon.' });
    else bucket.count += 1;
    next();
  };
}

app.post('/v1/webhooks/stripe', express.raw({ type: 'application/json' }), async (request, response) => {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET) return response.status(503).json({ error: 'Stripe is not configured' });
  const signature = request.headers['stripe-signature'];
  if (typeof signature !== 'string') return response.status(400).json({ error: 'Missing signature' });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(request.body, signature, config.STRIPE_WEBHOOK_SECRET); }
  catch { return response.status(400).json({ error: 'Invalid signature' }); }

  if (!db) return response.status(503).json({ error: 'Database is not configured' });
  const inserted = await db.insert(webhookEvents).values({ id: event.id, provider: 'stripe' }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (!inserted.length) return response.json({ received: true, duplicate: true });

  const object = event.data.object as unknown as Record<string, any>;
  const parentAccountId = object.metadata?.parentAccountId ?? object.client_reference_id;
  if (parentAccountId && ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const rawStatus = object.status as string | undefined;
    const status = event.type === 'customer.subscription.deleted'
      ? 'expired'
      : rawStatus === 'trialing' ? 'trialing'
        : rawStatus === 'active' ? 'active'
          : rawStatus === 'past_due' ? 'billing_retry'
            : 'free';
    await db.insert(subscriptionEntitlements).values({
      parentAccountId,
      status,
      source: 'stripe',
      plan: object.metadata?.plan,
      providerCustomerId: typeof object.customer === 'string' ? object.customer : object.customer?.id,
      providerSubscriptionId: object.object === 'subscription' ? object.id : object.subscription,
      currentPeriodEndsAt: object.current_period_end ? new Date(object.current_period_end * 1000) : null,
    }).onConflictDoUpdate({
      target: subscriptionEntitlements.parentAccountId,
      set: { status, source: 'stripe', updatedAt: new Date(), providerSubscriptionId: object.id },
    });
  }
  await db.update(webhookEvents).set({ processedAt: new Date() }).where(sql`${webhookEvents.id} = ${event.id}`);
  return response.json({ received: true });
});

app.use(express.json({ limit: '256kb' }));

app.get('/healthz', async (_request, response) => {
  const database = await checkDatabase();
  response.status(config.NODE_ENV === 'production' && !database ? 503 : 200).json({
    ok: config.NODE_ENV !== 'production' || database,
    service: 'glitter-api',
    database,
    askBloomMode: config.OPENAI_ZDR_APPROVED === 'true' && config.ASK_BLOOM_GENERATIVE_ENABLED === 'true' ? 'generative' : 'curated',
  });
});

app.get('/v1/content', (_request, response) => response.json({ items: EDUCATION_CONTENT }));

app.post('/v1/auth/request-link', rateLimit(5, 15 * 60_000), (request, response) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid email address' });
  return response.status(202).json({ accepted: true, message: 'If this account exists, a sign-in link will be sent.' });
});

app.post('/v1/dev/session', rateLimit(10, 60_000), (request, response) => {
  if (config.NODE_ENV === 'production') return response.status(404).end();
  const parsed = z.object({ role: z.enum(['parent', 'child']).default('child'), childId: z.string().uuid().optional() }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
  response.json({ token: createSessionToken({ subject: parsed.data.role === 'parent' ? '00000000-0000-4000-8000-000000000001' : 'device-preview', role: parsed.data.role, childId: parsed.data.childId }) });
});

const mutationSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  entityType: z.enum(['cycle-event', 'check-in', 'journal-entry', 'share-grant', 'education-progress']),
  operation: z.enum(['upsert', 'delete']),
  entityId: z.string().min(1).max(100),
  updatedAt: z.string().datetime(),
  payload: z.unknown(),
});

app.post('/v1/sync', requireSession('child'), rateLimit(120, 60_000), async (request, response) => {
  const parsed = z.object({ mutations: z.array(mutationSchema).max(100) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
  if (!request.session?.childId) return response.status(403).json({ error: 'Linked child profile required' });
  if (!db) return response.status(503).json({ error: 'Cloud sync is not configured; local data is unchanged.' });
  const childProfileId = request.session.childId;
  for (const mutation of parsed.data.mutations as SyncMutation[]) {
    await db.insert(syncRecords).values({
      childProfileId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      encryptedPayload: encryptField(mutation.payload),
      clientUpdatedAt: new Date(mutation.updatedAt),
      deletedAt: mutation.operation === 'delete' ? new Date() : null,
    }).onConflictDoUpdate({
      target: [syncRecords.childProfileId, syncRecords.entityType, syncRecords.entityId],
      set: {
        encryptedPayload: encryptField(mutation.payload),
        clientUpdatedAt: new Date(mutation.updatedAt),
        deletedAt: mutation.operation === 'delete' ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }
  response.json({ accepted: parsed.data.mutations.map((item) => item.idempotencyKey), serverTime: new Date().toISOString() });
});

app.get('/v1/entitlement', requireSession(), (_request, response) => response.json({ entitlement: normalizeEntitlement({ status: 'free' }) }));

app.post('/v1/checkout', requireSession('parent'), rateLimit(10, 60_000), async (request, response) => {
  const parsed = z.object({ plan: z.enum(['monthly', 'annual']) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Choose monthly or annual' });
  if (!stripe) return response.status(503).json({ error: 'Stripe checkout is not configured' });
  const price = parsed.data.plan === 'monthly' ? config.STRIPE_MONTHLY_PRICE_ID : config.STRIPE_ANNUAL_PRICE_ID;
  if (!price) return response.status(503).json({ error: 'Subscription price is not configured' });
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${config.PUBLIC_APP_URL}/parent?checkout=success`,
    cancel_url: `${config.PUBLIC_APP_URL}/plus?checkout=cancelled`,
    client_reference_id: request.session!.subject,
    metadata: { parentAccountId: request.session!.subject, plan: parsed.data.plan },
    subscription_data: { trial_period_days: 7, metadata: { parentAccountId: request.session!.subject, plan: parsed.data.plan } },
  });
  response.json({ url: session.url });
});

app.post('/v1/webhooks/apple', rateLimit(120, 60_000), (_request, response) => {
  response.status(501).json({ error: 'Apple signed-transaction verification must be configured before this endpoint can change entitlements.' });
});

app.post('/v1/ask-bloom', requireSession('child'), rateLimit(12, 60_000), async (request, response) => {
  const parsed = z.object({ question: z.string().trim().min(3).max(240) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Ask one short question.' });
  const question = parsed.data.question;
  const safety = classifySafety(question);
  if (safety !== 'standard') return response.json({ mode: 'fixed-safety', safety, answer: SAFETY_RESPONSES[safety], shareAllowed: true });
  const matches = findCuratedAnswer(question);
  const canGenerate = openai && config.OPENAI_ZDR_APPROVED === 'true' && config.ASK_BLOOM_GENERATIVE_ENABLED === 'true';
  if (!canGenerate) return response.json({ mode: 'curated', safety, items: matches, retained: false });

  const corpus = matches.map((item) => `${item.title}\n${item.body}`).join('\n\n');
  const result = await openai.responses.create({
    model: config.OPENAI_MODEL,
    store: false,
    input: [
      { role: 'developer', content: 'Answer for a 10 to 12 year old using only the supplied Glitter text. Use plain, calm language. Do not diagnose, give medication doses, request personal details, or claim certainty. If the text does not answer the question, say to ask a trusted grown-up.' },
      { role: 'user', content: `Glitter text:\n${corpus || 'No matching reviewed text.'}\n\nQuestion:\n${question}` },
    ],
  });
  response.json({ mode: 'generative-reviewed-corpus', safety, answer: result.output_text, retained: false });
});

app.post('/v1/account/export', requireSession('parent'), (_request, response) => response.status(501).json({ error: 'Cloud export requires a configured database and verified parent account.' }));
app.delete('/v1/account', requireSession('parent'), (_request, response) => response.status(501).json({ error: 'Cloud deletion requires re-authentication and a configured database.' }));

const webRoot = path.resolve(process.cwd(), 'dist');
if (existsSync(webRoot)) {
  app.use(express.static(webRoot, { index: false, maxAge: config.NODE_ENV === 'production' ? '1h' : 0 }));
}
app.use((request, response) => {
  if (existsSync(path.join(webRoot, 'index.html')) && request.accepts('html')) return response.sendFile(path.join(webRoot, 'index.html'));
  return response.status(404).json({ error: 'Not found' });
});
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  if (config.NODE_ENV !== 'test') console.error('[glitter-api]', message);
  response.status(500).json({ error: 'The request could not be completed.' });
});

export { app };
