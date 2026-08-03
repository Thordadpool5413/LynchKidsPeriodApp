import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import OpenAI from 'openai';
import { z } from 'zod';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PUBLISHED_CONTENT, filterPublished, findCuratedAnswer } from '../shared/content';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { addDays, predictNextPeriod } from '../shared/cycle';
import { normalizeEntitlement } from '../shared/entitlements';
import { classifySafety, SAFETY_RESPONSES } from '../shared/safety';
import { shouldAcceptMutation } from '../shared/sync';
import type { CycleEvent, ISODate, SyncMutation } from '../shared/types';
import { config } from './config';
import { db, checkDatabase } from './db/client';
import {
  auditEvents, careRequestResponses, careRequests, childProfiles, consentRecords, cycleForecasts,
  deviceLinkCodes, deviceRegistrations, magicLinkTokens, notificationJobs, parentAccounts,
  parentReminderPreferences, sessionRecords, shareGrants, subscriptionEntitlements, syncRecords, webhookEvents,
} from './db/schema';
import { consumeMagicLinkToken, createMagicLinkToken, createSessionToken, requireSession } from './security/auth';
import { decryptField, encryptField, fingerprint, randomOpaqueToken } from './security/crypto';
import { getEntitlement, getParentChild, hasActiveConsent, requirePlus } from './services/access';
import { sendParentMagicLink } from './services/email';
import { verifyAppleNotification } from './services/apple';

const app = express();
const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;
const openai = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;

export function resolveStaticPage(root: string, requestPath: string): string {
  const cleanRoute = requestPath.replace(/^\/+|\/+$/g, '');
  return cleanRoute ? path.join(root, `${cleanRoute}.html`) : path.join(root, 'index.html');
}

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const apiRoute = request.path === '/healthz' || request.path.startsWith('/v1/');
  response.setHeader('Content-Security-Policy', apiRoute
    ? "default-src 'none'; frame-ancestors 'none'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});
app.use(cors({ origin: config.PUBLIC_APP_URL, credentials: false, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));

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

  // Idempotency: check if this event was already successfully processed.
  // We intentionally do NOT treat an unprocessed (received but not yet completed)
  // record as a duplicate — that allows Stripe retries to finish interrupted events.
  const existing = await db.select({ processedAt: webhookEvents.processedAt })
    .from(webhookEvents)
    .where(sql`${webhookEvents.id} = ${event.id}`)
    .limit(1);
  if (existing.length && existing[0].processedAt !== null) {
    return response.json({ received: true, duplicate: true });
  }
  // Record receipt (no-op if already recorded from a previous attempt)
  await db.insert(webhookEvents).values({ id: event.id, provider: 'stripe' }).onConflictDoNothing();

  const object = event.data.object as unknown as Record<string, any>;
  const parentAccountId = object.metadata?.parentAccountId ?? object.client_reference_id;

  // Always ensure the parent account row exists when we have an ID — this satisfies
  // the FK constraint on subscription_entitlements for any downstream event.
  if (parentAccountId) {
    await db.insert(parentAccounts).values({
      id: parentAccountId,
      email: `webhook+${parentAccountId}@avacado.local`,
    }).onConflictDoNothing();
  }

  // Only subscription lifecycle events carry authoritative status.
  // checkout.session.completed has object.status = 'complete', which is not a
  // subscription state and would incorrectly overwrite a valid trialing/active
  // entitlement if events arrive out of order.
  if (parentAccountId && ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const rawStatus = object.status as string | undefined;
    const status = event.type === 'customer.subscription.deleted'
      ? 'expired'
      : rawStatus === 'trialing' ? 'trialing'
        : rawStatus === 'active' ? 'active'
          : rawStatus === 'past_due' ? 'billing_retry'
            : 'free';
    const eventTime = new Date(event.created * 1000);
    // Guard against out-of-order delivery: only overwrite if this event is newer
    // than whatever is already stored.  Uses a raw WHERE clause on the upsert.
    await db.execute(sql`
      INSERT INTO subscription_entitlements
        (parent_account_id, status, source, plan, provider_customer_id, provider_subscription_id, current_period_ends_at, trial_ends_at, updated_at)
      VALUES (
        ${parentAccountId},
        ${status},
        'stripe',
        ${object.metadata?.plan ?? null},
        ${typeof object.customer === 'string' ? object.customer : (object.customer?.id ?? null)},
        ${object.id},
        ${object.current_period_end ? new Date(object.current_period_end * 1000) : null},
        ${object.trial_end ? new Date(object.trial_end * 1000) : null},
        ${eventTime}
      )
      ON CONFLICT (parent_account_id) DO UPDATE SET
        status                  = EXCLUDED.status,
        source                  = EXCLUDED.source,
        plan                    = EXCLUDED.plan,
        provider_customer_id    = EXCLUDED.provider_customer_id,
        provider_subscription_id = EXCLUDED.provider_subscription_id,
        current_period_ends_at  = EXCLUDED.current_period_ends_at,
        trial_ends_at           = EXCLUDED.trial_ends_at,
        updated_at              = EXCLUDED.updated_at
      WHERE subscription_entitlements.updated_at < EXCLUDED.updated_at
    `);
  }
  // Only mark processed after the entitlement write succeeds.
  // If we threw above, processedAt stays null and the next Stripe retry will reprocess.
  await db.update(webhookEvents).set({ processedAt: new Date() }).where(sql`${webhookEvents.id} = ${event.id}`);
  return response.json({ received: true });
});

app.use(express.json({ limit: '256kb' }));

app.get('/healthz', async (_request, response) => {
  const database = await checkDatabase();
  const emailDelivery = config.SMTP_URL
    ? 'smtp'
    : process.env.REPLIT_CONNECTORS_HOSTNAME
      ? 'resend-connector'
      : config.NODE_ENV !== 'production' ? 'console-only' : 'none';
  response.status(config.NODE_ENV === 'production' && !database ? 503 : 200).json({
    ok: config.NODE_ENV !== 'production' || database,
    service: 'avacado-api',
    database,
    emailDelivery,
    askBloomMode: config.OPENAI_ZDR_APPROVED === 'true' && config.ASK_BLOOM_GENERATIVE_ENABLED === 'true' ? 'generative' : 'curated',
  });
});

// Exported for testing: allows injecting a catalog with known reviewed/draft items.
export function serveContent(catalog: ReturnType<typeof filterPublished>) {
  return (_request: Request, response: Response) => response.json({ items: catalog });
}
app.get('/v1/content', serveContent(PUBLISHED_CONTENT));

app.post('/v1/auth/request-link', rateLimit(5, 15 * 60_000), async (request, response) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid email address' });
  const { email } = parsed.data;
  const token = createMagicLinkToken(email);
  const link = `${config.PUBLIC_APP_URL}/parent?magicToken=${encodeURIComponent(token)}`;

  if (config.SMTP_URL) {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport(config.SMTP_URL);
      await transport.sendMail({
        from: config.EMAIL_FROM,
        to: email,
        subject: 'Sign in to AvaCado',
        text: `Tap the link below to sign in to your AvaCado parent account.\n\nThis link expires in 15 minutes and can only be used once.\n\n${link}\n\nIf you did not request this, you can safely ignore this email.`,
        html: `<p>Tap the link below to sign in to your AvaCado parent account.</p><p>This link expires in 15 minutes and can only be used once.</p><p><a href="${link}">Sign in to AvaCado</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
      });
    } catch (err) {
      console.error('[avacado-api] Failed to send magic-link email:', err instanceof Error ? err.message : err);
      return response.status(503).json({ error: 'Could not send sign-in email. Please try again.' });
    }
  } else if (process.env.REPLIT_CONNECTORS_HOSTNAME) {
    // Resend via Replit Connectors proxy — no manual API key required.
    try {
      const { ReplitConnectors } = await import('@replit/connectors-sdk');
      const connectors = new ReplitConnectors();
      // Pass the payload as a plain object so the SDK serialises it to JSON and
      // sets Content-Type: application/json automatically.
      const res = await connectors.proxy('resend', '/emails', {
        method: 'POST',
        body: {
          from: config.EMAIL_FROM,
          to: email,
          subject: 'Sign in to AvaCado',
          text: `Tap the link below to sign in to your AvaCado parent account.\n\nThis link expires in 15 minutes and can only be used once.\n\n${link}\n\nIf you did not request this, you can safely ignore this email.`,
          html: `<p>Tap the link below to sign in to your AvaCado parent account.</p><p>This link expires in 15 minutes and can only be used once.</p><p><a href="${link}">Sign in to AvaCado</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
        },
      });
      if (!res.ok) {
        const resBody = await res.text().catch(() => '');
        console.error('[avacado-api] Resend connector error:', res.status, resBody);
        return response.status(503).json({ error: 'Could not send sign-in email. Please try again.' });
      }
    } catch (err) {
      console.error('[avacado-api] Failed to send magic-link email via Resend:', err instanceof Error ? err.message : err);
      return response.status(503).json({ error: 'Could not send sign-in email. Please try again.' });
    }
  } else if (config.NODE_ENV !== 'production') {
    // No email transport configured — log the link only in dev/test so developers can follow it manually.
    // This branch is unreachable in production because config.ts requires email delivery there.
    console.info(`[avacado-api] Magic link for ${email}: ${link}`);
  } else {
    // Production with no email transport: refuse the request rather than silently failing to deliver.
    return response.status(503).json({ error: 'Email delivery is not configured. Contact support.' });
  }

  return response.status(202).json({ accepted: true, message: 'If this address is valid, a sign-in link will be sent.' });
});

app.get('/v1/auth/verify-link', rateLimit(20, 15 * 60_000), async (request, response) => {
  const token = typeof request.query.token === 'string' ? request.query.token : null;
  if (!token) return response.status(400).json({ error: 'Missing token' });

  const claims = consumeMagicLinkToken(token);
  if (!claims) return response.status(401).json({ error: 'This sign-in link has expired or has already been used. Please request a new one.' });

  const { email } = claims;
  let parentAccountId: string;
  let sessionId: string | undefined;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);

  if (db) {
    // Upsert the parent account and return its id.
    const rows = await db.insert(parentAccounts).values({ email }).onConflictDoUpdate({
      target: parentAccounts.email,
      set: { emailVerifiedAt: new Date() },
    }).returning({ id: parentAccounts.id });
    parentAccountId = rows[0].id;
    const [session] = await db.insert(sessionRecords).values({ ownerRole: 'parent', ownerId: parentAccountId, expiresAt }).returning({ id: sessionRecords.id });
    sessionId = session.id;
  } else {
    // No database in dev — derive a deterministic UUID from the email.
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(email).digest('hex');
    parentAccountId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }

  const sessionToken = createSessionToken({ subject: parentAccountId, role: 'parent', sessionId }, 30 * 24 * 60 * 60);
  return response.json({ token: sessionToken, parentAccountId, expiresAt: expiresAt.toISOString() });
});

app.post('/v1/auth/verify-link', rateLimit(10, 15 * 60_000), async (request, response) => {
  const parsed = z.object({ token: z.string().min(20).max(200) }).safeParse(request.body);
  if (!parsed.success || !db) return response.status(401).json({ error: 'This sign-in link is invalid or expired.' });
  const [link] = await db.select().from(magicLinkTokens).where(and(
    eq(magicLinkTokens.tokenHash, fingerprint(parsed.data.token)), isNull(magicLinkTokens.usedAt), gt(magicLinkTokens.expiresAt, new Date()),
  )).limit(1);
  if (!link) return response.status(401).json({ error: 'This sign-in link is invalid or expired.' });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const session = await db.transaction(async (tx) => {
    const consumed = await tx.update(magicLinkTokens).set({ usedAt: new Date() }).where(and(eq(magicLinkTokens.id, link.id), isNull(magicLinkTokens.usedAt), gt(magicLinkTokens.expiresAt, new Date()))).returning({ id: magicLinkTokens.id });
    if (!consumed.length) return null;
    await tx.update(parentAccounts).set({ emailVerifiedAt: new Date() }).where(eq(parentAccounts.id, link.parentAccountId));
    const [created] = await tx.insert(sessionRecords).values({ ownerRole: 'parent', ownerId: link.parentAccountId, expiresAt }).returning();
    return created;
  });
  if (!session) return response.status(401).json({ error: 'This sign-in link is invalid or expired.' });
  return response.json({ token: createSessionToken({ subject: link.parentAccountId, role: 'parent', sessionId: session.id }, 30 * 24 * 60 * 60), expiresAt: expiresAt.toISOString() });
});

app.post('/v1/dev/session', rateLimit(10, 60_000), (request, response) => {
  if (config.NODE_ENV === 'production') return response.status(404).end();
  const parsed = z.object({ role: z.enum(['parent', 'child']).default('child'), childId: z.string().uuid().optional() }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
  response.json({ token: createSessionToken({ subject: parsed.data.role === 'parent' ? '00000000-0000-4000-8000-000000000001' : 'device-preview', role: parsed.data.role, childId: parsed.data.childId }) });
});

const careItemCodes = [
  'pads', 'liners', 'period-underwear', 'spare-underwear', 'wipes', 'heat-pack', 'school-kit-refill',
  'water', 'warm-drink', 'parent-approved-snack', 'quiet-time', 'rest', 'comfort-item',
  'bathroom-plan', 'nurse-help', 'teacher-note', 'pickup', 'check-on-me',
] as const;
const careResponseCodes = ['got-it', 'help-soon', 'lets-talk', 'not-right-now'] as const;

async function parentIdForSession(request: Request): Promise<string | null> {
  if (!request.session) return null;
  if (request.session.role === 'parent') return request.session.subject;
  if (!db || !request.session.childId) return null;
  const [child] = await db.select({ parentAccountId: childProfiles.parentAccountId }).from(childProfiles)
    .where(eq(childProfiles.id, request.session.childId)).limit(1);
  return child?.parentAccountId ?? null;
}

async function recordAudit(input: { parentAccountId?: string; childProfileId?: string; actorType: 'parent' | 'child' | 'system'; action: string; resourceType: string; resourceId?: string }) {
  if (!db) return;
  await db.insert(auditEvents).values(input);
}

function localDateHourToUtc(date: ISODate, hour: number, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  let guess = Date.UTC(year, month - 1, day, hour);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour));
    guess += Date.UTC(year, month - 1, day, hour) - observed;
  }
  return new Date(guess);
}

async function refreshForecastAndJobs(childProfileId: string) {
  if (!db) return;
  const records = await db.select().from(syncRecords).where(and(eq(syncRecords.childProfileId, childProfileId), eq(syncRecords.entityType, 'cycle-event'), isNull(syncRecords.deletedAt)));
  const events = records.map((record) => decryptField<CycleEvent>(record.encryptedPayload as never));
  const today = new Date().toISOString().slice(0, 10) as ISODate;
  const prediction = predictNextPeriod(events, today);
  if (!prediction.nextStart) return;
  const sourceRevision = fingerprint(events.map((event) => `${event.id}:${event.updatedAt}`).sort().join('|'));
  await db.insert(cycleForecasts).values({ childProfileId, estimatedDate: prediction.nextStart, confidence: prediction.confidence === 'pattern-based' ? 'high' : 'low', sourceRevision })
    .onConflictDoUpdate({ target: cycleForecasts.childProfileId, set: { estimatedDate: prediction.nextStart, confidence: prediction.confidence === 'pattern-based' ? 'high' : 'low', sourceRevision, calculatedAt: new Date() } });
  const [child] = await db.select({ parentAccountId: childProfiles.parentAccountId }).from(childProfiles).where(eq(childProfiles.id, childProfileId)).limit(1);
  const parentAccountId = child?.parentAccountId;
  if (!parentAccountId || !(await requirePlus(parentAccountId)) || !(await hasActiveConsent(parentAccountId, childProfileId))) return;
  const [preference] = await db.select().from(parentReminderPreferences).where(and(eq(parentReminderPreferences.parentAccountId, parentAccountId), eq(parentReminderPreferences.childProfileId, childProfileId), eq(parentReminderPreferences.enabled, true))).limit(1);
  if (!preference) return;
  await db.update(notificationJobs).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(notificationJobs.childProfileId, childProfileId), eq(notificationJobs.templateCode, 'forecast-soon'), inArray(notificationJobs.status, ['pending', 'retry'])));
  const devices = await db.select({ id: deviceRegistrations.id }).from(deviceRegistrations).where(and(eq(deviceRegistrations.parentAccountId, parentAccountId), eq(deviceRegistrations.ownerRole, 'parent'), eq(deviceRegistrations.enabled, true), isNull(deviceRegistrations.revokedAt)));
  for (const leadDay of preference.leadDays as number[]) {
    const localDate = addDays(prediction.nextStart, -leadDay);
    const deliveryHour = preference.quietHoursEnd >= 7 && preference.quietHoursEnd <= 10 ? preference.quietHoursEnd : 9;
    const scheduledAt = localDateHourToUtc(localDate, deliveryHour, preference.timezone);
    if (scheduledAt <= new Date()) continue;
    for (const device of devices) await db.insert(notificationJobs).values({ deviceRegistrationId: device.id, parentAccountId, childProfileId, templateCode: 'forecast-soon', scheduledAt, deduplicationKey: `forecast:${sourceRevision}:${leadDay}:${device.id}` }).onConflictDoNothing();
  }
}

app.post('/v1/parent/consent', requireSession('parent'), async (request, response) => {
  const parsed = z.object({ verificationReference: z.string().min(8).max(160), verificationProof: z.string().min(40).max(160), policyVersion: z.string().optional() }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Verified parent consent is required.' });
  if (!db) return response.status(503).json({ error: 'Cloud consent is not configured.' });
  const parentAccountId = request.session!.subject;
  if (config.VPC_PROVIDER_ENABLED !== 'true' || !config.VPC_PROVIDER_SECRET) return response.status(503).json({ error: 'Cloud features are paused until verified parental consent review is enabled.' });
  const expectedProof = createHmac('sha256', config.VPC_PROVIDER_SECRET).update(`${parentAccountId}:${parsed.data.verificationReference}`).digest();
  const providedProof = Buffer.from(parsed.data.verificationProof, 'base64url');
  if (providedProof.length !== expectedProof.length || !timingSafeEqual(providedProof, expectedProof)) return response.status(403).json({ error: 'The parental verification could not be confirmed.' });
  let childProfileId = await getParentChild(parentAccountId);
  if (!childProfileId) {
    const [child] = await db.insert(childProfiles).values({ parentAccountId, encryptedProfile: encryptField({ version: 1 }), cloudSyncEnabled: true }).returning({ id: childProfiles.id });
    childProfileId = child.id;
  }
  const [consent] = await db.insert(consentRecords).values({
    parentAccountId, childProfileId, policyVersion: parsed.data.policyVersion ?? config.CONSENT_POLICY_VERSION,
    method: `verified-provider:${fingerprint(parsed.data.verificationReference).slice(0, 16)}`,
  }).returning();
  await recordAudit({ parentAccountId, childProfileId, actorType: 'parent', action: 'consent-recorded', resourceType: 'consent', resourceId: consent.id });
  return response.status(201).json({ childProfileId, consentedAt: consent.consentedAt.toISOString(), policyVersion: consent.policyVersion });
});

app.post('/v1/parent/link-codes', requireSession('parent'), rateLimit(5, 10 * 60_000), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Device linking is not configured.' });
  const parentAccountId = request.session!.subject;
  const childProfileId = await getParentChild(parentAccountId);
  if (!childProfileId || !(await hasActiveConsent(parentAccountId, childProfileId))) return response.status(403).json({ error: 'Verified parent consent is required before linking a child device.' });
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.insert(deviceLinkCodes).values({ parentAccountId, childProfileId, codeHash: fingerprint(code), expiresAt });
  await recordAudit({ parentAccountId, childProfileId, actorType: 'parent', action: 'link-code-created', resourceType: 'device-link' });
  return response.status(201).json({ code, expiresAt: expiresAt.toISOString() });
});

app.post('/v1/child/link', rateLimit(10, 10 * 60_000), async (request, response) => {
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(request.body);
  if (!parsed.success || !db) return response.status(400).json({ error: 'Enter the six-digit code from your grown-up.' });
  const [link] = await db.select().from(deviceLinkCodes).where(and(
    eq(deviceLinkCodes.codeHash, fingerprint(parsed.data.code)), isNull(deviceLinkCodes.usedAt), gt(deviceLinkCodes.expiresAt, new Date()),
  )).limit(1);
  if (!link || !(await hasActiveConsent(link.parentAccountId, link.childProfileId))) return response.status(401).json({ error: 'That code is invalid or expired.' });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const session = await db.transaction(async (tx) => {
    const consumed = await tx.update(deviceLinkCodes).set({ usedAt: new Date() }).where(and(eq(deviceLinkCodes.id, link.id), isNull(deviceLinkCodes.usedAt), gt(deviceLinkCodes.expiresAt, new Date()))).returning({ id: deviceLinkCodes.id });
    if (!consumed.length) return null;
    const [created] = await tx.insert(sessionRecords).values({ ownerRole: 'child', ownerId: link.childProfileId, childProfileId: link.childProfileId, expiresAt }).returning();
    return created;
  });
  if (!session) return response.status(401).json({ error: 'That code is invalid or expired.' });
  await recordAudit({ parentAccountId: link.parentAccountId, childProfileId: link.childProfileId, actorType: 'child', action: 'device-linked', resourceType: 'session', resourceId: session.id });
  return response.json({ token: createSessionToken({ subject: link.childProfileId, role: 'child', childId: link.childProfileId, sessionId: session.id }, 30 * 24 * 60 * 60), childProfileId: link.childProfileId, expiresAt: expiresAt.toISOString() });
});

app.delete('/v1/sessions/:id', requireSession(), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Session management is not configured.' });
  const parameterId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const targetId = parameterId === 'current' ? request.session!.sessionId : parameterId;
  if (!targetId) return response.status(404).json({ error: 'Session not found.' });
  const ownerId = request.session!.role === 'parent' ? request.session!.subject : request.session!.childId;
  const updated = await db.update(sessionRecords).set({ revokedAt: new Date() }).where(and(eq(sessionRecords.id, targetId), eq(sessionRecords.ownerId, ownerId!))).returning({ id: sessionRecords.id });
  return updated.length ? response.status(204).end() : response.status(404).json({ error: 'Session not found.' });
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
    const incomingUpdatedAt = new Date(mutation.updatedAt);
    const [currentRecord] = await db.select({ clientUpdatedAt: syncRecords.clientUpdatedAt, revisionKey: syncRecords.revisionKey }).from(syncRecords).where(and(eq(syncRecords.childProfileId, childProfileId), eq(syncRecords.entityType, mutation.entityType), eq(syncRecords.entityId, mutation.entityId))).limit(1);
    if (!shouldAcceptMutation(currentRecord ? { updatedAt: currentRecord.clientUpdatedAt, revisionKey: currentRecord.revisionKey } : undefined, { updatedAt: incomingUpdatedAt, revisionKey: mutation.idempotencyKey })) continue;
    if (mutation.entityType === 'share-grant') {
      const grant = z.object({ resourceType: z.enum(['journal', 'ai-answer', 'care-summary']), resourceId: z.string().min(1).max(100) }).safeParse(mutation.payload);
      if (mutation.operation === 'upsert' && grant.success) {
        const existing = await db.select({ id: shareGrants.id }).from(shareGrants).where(and(eq(shareGrants.childProfileId, childProfileId), eq(shareGrants.resourceType, grant.data.resourceType), eq(shareGrants.resourceId, grant.data.resourceId), isNull(shareGrants.revokedAt))).limit(1);
        if (!existing.length) await db.insert(shareGrants).values({ childProfileId, resourceType: grant.data.resourceType, resourceId: grant.data.resourceId });
      } else if (mutation.operation === 'delete') {
        const payload = z.object({ resourceType: z.enum(['journal', 'ai-answer', 'care-summary']), resourceId: z.string() }).safeParse(mutation.payload);
        if (payload.success) await db.update(shareGrants).set({ revokedAt: new Date() }).where(and(eq(shareGrants.childProfileId, childProfileId), eq(shareGrants.resourceType, payload.data.resourceType), eq(shareGrants.resourceId, payload.data.resourceId), isNull(shareGrants.revokedAt)));
      }
    }
    if (mutation.entityType === 'journal-entry') {
      const shared = await db.select({ id: shareGrants.id }).from(shareGrants).where(and(eq(shareGrants.childProfileId, childProfileId), eq(shareGrants.resourceType, 'journal'), eq(shareGrants.resourceId, mutation.entityId), isNull(shareGrants.revokedAt))).limit(1);
      if (!shared.length && mutation.operation === 'upsert') return response.status(403).json({ error: 'Journal pages stay private until the child shares that page.' });
    }
    await db.insert(syncRecords).values({
      childProfileId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      encryptedPayload: encryptField(mutation.payload),
      clientUpdatedAt: incomingUpdatedAt,
      revisionKey: mutation.idempotencyKey,
      deletedAt: mutation.operation === 'delete' ? new Date() : null,
    }).onConflictDoUpdate({
      target: [syncRecords.childProfileId, syncRecords.entityType, syncRecords.entityId],
      set: {
        encryptedPayload: encryptField(mutation.payload),
        clientUpdatedAt: incomingUpdatedAt,
        revisionKey: mutation.idempotencyKey,
        deletedAt: mutation.operation === 'delete' ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }
  if (parsed.data.mutations.some((item) => item.entityType === 'cycle-event')) await refreshForecastAndJobs(childProfileId);
  response.json({ accepted: parsed.data.mutations.map((item) => item.idempotencyKey), serverTime: new Date().toISOString() });
});

app.get('/v1/entitlement', requireSession(), async (request, response) => {
  const parentAccountId = await parentIdForSession(request);
  return response.json({ entitlement: parentAccountId ? await getEntitlement(parentAccountId) : normalizeEntitlement({ status: 'free' }) });
});

app.post('/v1/devices', requireSession(), async (request, response) => {
  const parsed = z.object({ expoPushToken: z.string().regex(/^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/), platform: z.enum(['ios', 'android']) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'A valid Expo push token is required.' });
  if (!db) return response.status(503).json({ error: 'Push registration is not configured.' });
  const parentAccountId = await parentIdForSession(request);
  const childProfileId = request.session!.childId ?? (parentAccountId ? await getParentChild(parentAccountId) : null);
  if (!parentAccountId || !childProfileId || !(await hasActiveConsent(parentAccountId, childProfileId))) return response.status(403).json({ error: 'Verified parent consent is required before push alerts.' });
  const tokenFingerprint = fingerprint(parsed.data.expoPushToken);
  const [device] = await db.insert(deviceRegistrations).values({
    parentAccountId, childProfileId, ownerRole: request.session!.role, encryptedExpoToken: encryptField(parsed.data.expoPushToken),
    tokenFingerprint, platform: parsed.data.platform,
  }).onConflictDoUpdate({ target: deviceRegistrations.tokenFingerprint, set: { enabled: true, revokedAt: null, lastSeenAt: new Date(), encryptedExpoToken: encryptField(parsed.data.expoPushToken) } }).returning();
  return response.status(201).json({ id: device.id, ownerRole: device.ownerRole, platform: device.platform, enabled: device.enabled, lastSeenAt: device.lastSeenAt.toISOString() });
});

app.delete('/v1/devices/:id', requireSession(), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Push registration is not configured.' });
  const parentAccountId = await parentIdForSession(request);
  const childProfileId = request.session!.childId;
  const ownership = request.session!.role === 'parent'
    ? eq(deviceRegistrations.parentAccountId, parentAccountId!)
    : eq(deviceRegistrations.childProfileId, childProfileId!);
  const deviceId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const result = await db.update(deviceRegistrations).set({ enabled: false, revokedAt: new Date() }).where(and(eq(deviceRegistrations.id, deviceId), ownership)).returning({ id: deviceRegistrations.id });
  return result.length ? response.status(204).end() : response.status(404).json({ error: 'Device not found.' });
});

app.get('/v1/parent/reminder-preferences', requireSession('parent'), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Parent reminders are not configured.' });
  const childProfileId = await getParentChild(request.session!.subject);
  if (!childProfileId) return response.status(404).json({ error: 'No linked child profile.' });
  const [record] = await db.select().from(parentReminderPreferences).where(and(eq(parentReminderPreferences.parentAccountId, request.session!.subject), eq(parentReminderPreferences.childProfileId, childProfileId))).limit(1);
  return response.json({ preference: record ? { enabled: record.enabled, timezone: record.timezone, quietHoursStart: record.quietHoursStart, quietHoursEnd: record.quietHoursEnd, leadDays: record.leadDays, phraseCode: record.phraseCode, consentedAt: record.consentedAt?.toISOString() } : { enabled: false, timezone: 'America/New_York', quietHoursStart: 20, quietHoursEnd: 7, leadDays: [5, 1], phraseCode: 'garden-moment' } });
});

app.patch('/v1/parent/reminder-preferences', requireSession('parent'), async (request, response) => {
  const parsed = z.object({ enabled: z.boolean(), timezone: z.string().min(3).max(64), quietHoursStart: z.number().int().min(0).max(23), quietHoursEnd: z.number().int().min(0).max(23), leadDays: z.array(z.number().int().min(1).max(14)).min(1).max(3), phraseCode: z.enum(['garden-moment', 'little-kit']) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Check the reminder settings and try again.' });
  if (!db) return response.status(503).json({ error: 'Parent reminders are not configured.' });
  const parentAccountId = request.session!.subject;
  const childProfileId = await getParentChild(parentAccountId);
  if (!childProfileId || !(await hasActiveConsent(parentAccountId, childProfileId))) return response.status(403).json({ error: 'Verified parent consent is required.' });
  if (!(await requirePlus(parentAccountId))) return response.status(402).json({ error: 'AvaCado Plus is required for parent forecast alerts.' });
  const [record] = await db.insert(parentReminderPreferences).values({ parentAccountId, childProfileId, ...parsed.data, consentedAt: parsed.data.enabled ? new Date() : null })
    .onConflictDoUpdate({ target: [parentReminderPreferences.parentAccountId, parentReminderPreferences.childProfileId], set: { ...parsed.data, consentedAt: parsed.data.enabled ? new Date() : null, updatedAt: new Date() } }).returning();
  await recordAudit({ parentAccountId, childProfileId, actorType: 'parent', action: parsed.data.enabled ? 'parent-reminders-enabled' : 'parent-reminders-disabled', resourceType: 'reminder-preference', resourceId: record.id });
  return response.json({ preference: { ...parsed.data, consentedAt: record.consentedAt?.toISOString() } });
});

app.post('/v1/care-requests', requireSession('child'), rateLimit(10, 60_000), async (request, response) => {
  const parsed = z.object({ clientRequestId: z.string().min(8).max(100), items: z.array(z.enum(careItemCodes)).min(1).max(12), note: z.string().trim().max(120).optional(), urgentSafety: z.boolean().default(false) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Choose at least one way your grown-up can help.' });
  if (!db || !request.session!.childId) return response.status(503).json({ error: 'Care Requests are unavailable offline. Your choices have not been lost.' });
  const childProfileId = request.session!.childId;
  const parentAccountId = await parentIdForSession(request);
  if (!parentAccountId || !(await hasActiveConsent(parentAccountId, childProfileId))) return response.status(403).json({ error: 'A linked grown-up and verified consent are required.' });
  if (!parsed.data.urgentSafety && !(await requirePlus(parentAccountId))) return response.status(402).json({ error: 'AvaCado Plus is required for regular Care Requests.' });
  if (parsed.data.urgentSafety && (parsed.data.items.length !== 1 || parsed.data.items[0] !== 'check-on-me' || parsed.data.note)) return response.status(400).json({ error: 'Urgent safety sharing sends only a private check-on-me signal.' });
  const existing = await db.select({ id: careRequests.id }).from(careRequests).where(and(eq(careRequests.childProfileId, childProfileId), eq(careRequests.status, 'open'), eq(careRequests.urgentSafety, parsed.data.urgentSafety), gt(careRequests.expiresAt, new Date()))).limit(1);
  if (existing.length) return response.status(409).json({ error: 'You already have a garden note waiting. Edit or cancel it first.', requestId: existing[0].id });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  const [created] = await db.insert(careRequests).values({ parentAccountId, childProfileId, clientRequestId: parsed.data.clientRequestId, encryptedItems: encryptField([...new Set(parsed.data.items)]), encryptedNote: parsed.data.note ? encryptField(parsed.data.note) : null, urgentSafety: parsed.data.urgentSafety, expiresAt }).onConflictDoNothing().returning();
  const requestRecord = created ?? (await db.select().from(careRequests).where(and(eq(careRequests.childProfileId, childProfileId), eq(careRequests.clientRequestId, parsed.data.clientRequestId))).limit(1))[0];
  if (!requestRecord) return response.status(409).json({ error: 'This request was already processed.' });
  const devices = await db.select({ id: deviceRegistrations.id }).from(deviceRegistrations).where(and(eq(deviceRegistrations.parentAccountId, parentAccountId), eq(deviceRegistrations.ownerRole, 'parent'), eq(deviceRegistrations.enabled, true), isNull(deviceRegistrations.revokedAt)));
  for (const device of devices) await db.insert(notificationJobs).values({ deviceRegistrationId: device.id, parentAccountId, childProfileId, templateCode: 'care-request', scheduledAt: new Date(), deduplicationKey: `care:${requestRecord.id}:${device.id}` }).onConflictDoNothing();
  await recordAudit({ parentAccountId, childProfileId, actorType: 'child', action: parsed.data.urgentSafety ? 'urgent-safety-shared' : 'care-request-created', resourceType: 'care-request', resourceId: requestRecord.id });
  return response.status(201).json({ request: { id: requestRecord.id, items: parsed.data.items, note: parsed.data.note, urgentSafety: parsed.data.urgentSafety, status: requestRecord.status, createdAt: requestRecord.createdAt.toISOString(), updatedAt: requestRecord.updatedAt.toISOString(), expiresAt: requestRecord.expiresAt.toISOString() } });
});

app.get('/v1/care-requests', requireSession(), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Care Requests are not configured.' });
  const parentAccountId = await parentIdForSession(request);
  const childProfileId = request.session!.childId ?? (parentAccountId ? await getParentChild(parentAccountId) : null);
  if (!parentAccountId || !childProfileId) return response.status(403).json({ error: 'A linked profile is required.' });
  const records = await db.select().from(careRequests).where(and(
    eq(careRequests.parentAccountId, parentAccountId), eq(careRequests.childProfileId, childProfileId),
  )).orderBy(desc(careRequests.createdAt)).limit(30);
  const ids = records.map((item) => item.id);
  const responses = ids.length ? await db.select().from(careRequestResponses).where(inArray(careRequestResponses.careRequestId, ids)) : [];
  const responseByRequest = new Map(responses.map((item) => [item.careRequestId, item.responseCode]));
  return response.json({ requests: records.map((item) => ({
    id: item.id,
    items: decryptField<string[]>(item.encryptedItems as never),
    ...(item.encryptedNote ? { note: decryptField<string>(item.encryptedNote as never) } : {}),
    status: item.status,
    urgentSafety: item.urgentSafety,
    responseCode: responseByRequest.get(item.id),
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), expiresAt: item.expiresAt.toISOString(),
  })) });
});

app.patch('/v1/care-requests/:id/status', requireSession(), async (request, response) => {
  const parsed = z.object({ action: z.enum(['cancel', 'edit', 'acknowledge']), responseCode: z.enum(careResponseCodes).optional(), items: z.array(z.enum(careItemCodes)).min(1).max(12).optional(), note: z.string().trim().max(120).optional() })
    .refine((value) => value.action !== 'acknowledge' || Boolean(value.responseCode))
    .refine((value) => value.action !== 'edit' || Boolean(value.items?.length)).safeParse(request.body);
  if (!parsed.success || !db) return response.status(400).json({ error: 'Choose a valid response.' });
  const parentAccountId = await parentIdForSession(request);
  const childProfileId = request.session!.childId ?? (parentAccountId ? await getParentChild(parentAccountId) : null);
  if (!parentAccountId || !childProfileId) return response.status(403).json({ error: 'A linked profile is required.' });
  const careRequestId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const [record] = await db.select().from(careRequests).where(and(eq(careRequests.id, careRequestId), eq(careRequests.parentAccountId, parentAccountId), eq(careRequests.childProfileId, childProfileId))).limit(1);
  if (!record) return response.status(404).json({ error: 'Care Request not found.' });
  if (record.status !== 'open') return response.status(409).json({ error: 'This Care Request is already closed.' });
  if (parsed.data.action === 'edit') {
    if (request.session!.role !== 'child') return response.status(403).json({ error: 'Only the child can edit this request.' });
    await db.update(careRequests).set({ encryptedItems: encryptField([...new Set(parsed.data.items!)]), encryptedNote: parsed.data.note ? encryptField(parsed.data.note) : null, updatedAt: new Date() }).where(eq(careRequests.id, record.id));
    await recordAudit({ parentAccountId, childProfileId, actorType: 'child', action: 'care-request-edited', resourceType: 'care-request', resourceId: record.id });
    return response.json({ status: 'open' });
  }
  if (parsed.data.action === 'cancel') {
    if (request.session!.role !== 'child') return response.status(403).json({ error: 'Only the child can cancel this request.' });
    await db.update(careRequests).set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() }).where(eq(careRequests.id, record.id));
    await recordAudit({ parentAccountId, childProfileId, actorType: 'child', action: 'care-request-cancelled', resourceType: 'care-request', resourceId: record.id });
    return response.json({ status: 'cancelled' });
  }
  if (request.session!.role !== 'parent') return response.status(403).json({ error: 'Only the grown-up can acknowledge this request.' });
  await db.transaction(async (tx) => {
    await tx.update(careRequests).set({ status: 'acknowledged', acknowledgedAt: new Date(), updatedAt: new Date() }).where(eq(careRequests.id, record.id));
    await tx.insert(careRequestResponses).values({ careRequestId: record.id, parentAccountId, responseCode: parsed.data.responseCode! });
  });
  await recordAudit({ parentAccountId, childProfileId, actorType: 'parent', action: 'care-request-acknowledged', resourceType: 'care-request', resourceId: record.id });
  return response.json({ status: 'acknowledged', responseCode: parsed.data.responseCode });
});

app.get('/v1/child/link-status', requireSession('child'), async (request, response) => {
  if (!db || !request.session!.childId) return response.json({ linked: false, parentRemindersEnabled: false });
  const parentAccountId = await parentIdForSession(request);
  if (!parentAccountId) return response.json({ linked: false, parentRemindersEnabled: false });
  const [preference] = await db.select({ enabled: parentReminderPreferences.enabled }).from(parentReminderPreferences).where(and(eq(parentReminderPreferences.parentAccountId, parentAccountId), eq(parentReminderPreferences.childProfileId, request.session!.childId))).limit(1);
  return response.json({ linked: true, parentRemindersEnabled: preference?.enabled ?? false, disclosure: preference?.enabled ? 'Your grown-up receives private garden reminders.' : 'Parent garden reminders are off.' });
});

app.get('/v1/parent/dashboard', requireSession('parent'), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Parent dashboard is not configured.' });
  const parentAccountId = request.session!.subject;
  const childProfileId = await getParentChild(parentAccountId);
  if (!childProfileId) return response.json({ linked: false, careRequests: [], forecast: null });
  if (!(await hasActiveConsent(parentAccountId, childProfileId))) return response.status(403).json({ error: 'Verified parent consent is required.' });
  const [forecast] = await db.select().from(cycleForecasts).where(eq(cycleForecasts.childProfileId, childProfileId)).limit(1);
  const requests = await db.select().from(careRequests).where(and(eq(careRequests.parentAccountId, parentAccountId), eq(careRequests.childProfileId, childProfileId))).orderBy(desc(careRequests.createdAt)).limit(10);
  await recordAudit({ parentAccountId, childProfileId, actorType: 'parent', action: 'parent-dashboard-viewed', resourceType: 'dashboard' });
  return response.json({ linked: true, forecast: forecast ? { estimatedDate: forecast.estimatedDate, confidence: forecast.confidence, calculatedAt: forecast.calculatedAt.toISOString() } : null, careRequests: requests.map((item) => ({ id: item.id, items: decryptField<string[]>(item.encryptedItems as never), ...(item.encryptedNote ? { note: decryptField<string>(item.encryptedNote as never) } : {}), urgentSafety: item.urgentSafety, status: item.status, createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt.toISOString() })) });
});

app.post('/v1/checkout', requireSession('parent'), rateLimit(10, 60_000), async (request, response) => {
  const parsed = z.object({ plan: z.enum(['monthly', 'annual']) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Choose monthly or annual' });
  if (!stripe) return response.status(503).json({ error: 'Stripe checkout is not configured' });
  const price = parsed.data.plan === 'monthly' ? config.STRIPE_MONTHLY_PRICE_ID : config.STRIPE_ANNUAL_PRICE_ID;
  if (!price) return response.status(503).json({ error: 'Subscription price is not configured' });
  const parentAccountId = request.session!.subject;
  // Ensure the parent account row exists so the webhook's FK-backed entitlement
  // insert doesn't fail.  This is a no-op for accounts created via normal sign-up
  // and covers dev sessions whose UUID is synthetic.
  if (db) {
    await db.insert(parentAccounts).values({
      id: parentAccountId,
      email: `checkout+${parentAccountId}@avacado.local`,
    }).onConflictDoNothing();
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${config.PUBLIC_APP_URL}/parent?checkout=success`,
    cancel_url: `${config.PUBLIC_APP_URL}/plus?checkout=cancelled`,
    client_reference_id: parentAccountId,
    metadata: { parentAccountId, plan: parsed.data.plan },
    subscription_data: { trial_period_days: 7, metadata: { parentAccountId, plan: parsed.data.plan } },
  });
  response.json({ url: session.url });
});

app.post('/v1/billing/portal', requireSession('parent'), rateLimit(10, 60_000), async (request, response) => {
  if (!stripe) return response.status(503).json({ error: 'Stripe is not configured' });
  if (!db) return response.status(503).json({ error: 'Database is not configured' });
  const parentAccountId = request.session!.subject;
  const rows = await db.select({ providerCustomerId: subscriptionEntitlements.providerCustomerId })
    .from(subscriptionEntitlements)
    .where(sql`${subscriptionEntitlements.parentAccountId} = ${parentAccountId}`)
    .limit(1);
  if (!rows.length || !rows[0].providerCustomerId) {
    return response.status(404).json({ error: 'No billing record found. Please contact support.' });
  }
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: rows[0].providerCustomerId,
    return_url: `${config.PUBLIC_APP_URL}/plus`,
  });
  return response.json({ url: portalSession.url });
});

app.post('/v1/webhooks/apple', rateLimit(120, 60_000), async (request, response) => {
  const parsed = z.object({ signedPayload: z.string().min(40) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Missing signed payload' });
  if (!db || !config.APPLE_ROOT_CA_BASE64) return response.status(503).json({ error: 'Apple verification is not configured' });
  try {
    const verified = await verifyAppleNotification(parsed.data.signedPayload);
    const inserted = await db.insert(webhookEvents).values({ id: verified.eventId, provider: 'apple' }).onConflictDoNothing().returning({ id: webhookEvents.id });
    if (!inserted.length) return response.json({ received: true, duplicate: true });
    const validParentId = z.string().uuid().safeParse(verified.parentAccountId);
    if (validParentId.success) {
      await db.insert(subscriptionEntitlements).values({ parentAccountId: validParentId.data, status: verified.status, source: 'apple', plan: verified.plan, providerSubscriptionId: verified.originalTransactionId, currentPeriodEndsAt: verified.expiresAt })
        .onConflictDoUpdate({ target: subscriptionEntitlements.parentAccountId, set: { status: verified.status, source: 'apple', plan: verified.plan, providerSubscriptionId: verified.originalTransactionId, currentPeriodEndsAt: verified.expiresAt, updatedAt: new Date() } });
    }
    await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, verified.eventId));
    return response.json({ received: true });
  } catch {
    return response.status(400).json({ error: 'Invalid Apple signed payload' });
  }
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
      { role: 'developer', content: 'Answer for a 10 to 12 year old using only the supplied AvaCado text. Use plain, calm language. Do not diagnose, give medication doses, request personal details, or claim certainty. If the text does not answer the question, say to ask a trusted grown-up.' },
      { role: 'user', content: `AvaCado text:\n${corpus || 'No matching reviewed text.'}\n\nQuestion:\n${question}` },
    ],
  });
  response.json({ mode: 'generative-reviewed-corpus', safety, answer: result.output_text, retained: false });
});

app.post('/v1/account/export', requireSession('parent'), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Cloud export is not configured.' });
  const parentAccountId = request.session!.subject;
  const childProfileId = await getParentChild(parentAccountId);
  const parent = (await db.select({ id: parentAccounts.id, email: parentAccounts.email, createdAt: parentAccounts.createdAt }).from(parentAccounts).where(eq(parentAccounts.id, parentAccountId)).limit(1))[0];
  if (!parent) return response.status(404).json({ error: 'Account not found.' });
  const consent = childProfileId ? await db.select().from(consentRecords).where(and(eq(consentRecords.parentAccountId, parentAccountId), eq(consentRecords.childProfileId, childProfileId))) : [];
  const grants = childProfileId ? await db.select().from(shareGrants).where(and(eq(shareGrants.childProfileId, childProfileId), isNull(shareGrants.revokedAt))) : [];
  const sharedJournalIds = new Set(grants.filter((grant) => grant.resourceType === 'journal').map((grant) => grant.resourceId));
  const records = childProfileId ? await db.select().from(syncRecords).where(eq(syncRecords.childProfileId, childProfileId)) : [];
  const permittedRecords = records.filter((record) => record.entityType !== 'journal-entry' || sharedJournalIds.has(record.entityId));
  const care = childProfileId ? await db.select().from(careRequests).where(eq(careRequests.childProfileId, childProfileId)) : [];
  await recordAudit({ parentAccountId, childProfileId: childProfileId ?? undefined, actorType: 'parent', action: 'account-exported', resourceType: 'account', resourceId: parentAccountId });
  return response.json({
    exportedAt: new Date().toISOString(), parent: { ...parent, createdAt: parent.createdAt.toISOString() },
    childProfileId,
    consents: consent.map((item) => ({ policyVersion: item.policyVersion, method: item.method, consentedAt: item.consentedAt.toISOString(), revokedAt: item.revokedAt?.toISOString() })),
    sharedData: permittedRecords.map((item) => ({ entityType: item.entityType, entityId: item.entityId, data: decryptField(item.encryptedPayload as never), updatedAt: item.updatedAt.toISOString(), deletedAt: item.deletedAt?.toISOString() })),
    careRequests: care.map((item) => ({ id: item.id, items: decryptField(item.encryptedItems as never), ...(item.encryptedNote ? { note: decryptField(item.encryptedNote as never) } : {}), urgentSafety: item.urgentSafety, status: item.status, createdAt: item.createdAt.toISOString() })),
    privacyNote: 'Private journal entries that were not individually shared are intentionally excluded from the parent export.',
  });
});

app.post('/v1/parent/unlink', requireSession('parent'), async (request, response) => {
  if (!db) return response.status(503).json({ error: 'Unlinking is not configured.' });
  const parentAccountId = request.session!.subject;
  const childProfileId = await getParentChild(parentAccountId);
  if (!childProfileId) return response.status(204).end();
  await db.transaction(async (tx) => {
    await tx.update(consentRecords).set({ revokedAt: new Date() }).where(and(eq(consentRecords.parentAccountId, parentAccountId), eq(consentRecords.childProfileId, childProfileId), isNull(consentRecords.revokedAt)));
    await tx.update(deviceRegistrations).set({ enabled: false, revokedAt: new Date() }).where(or(eq(deviceRegistrations.parentAccountId, parentAccountId), eq(deviceRegistrations.childProfileId, childProfileId)));
    await tx.update(sessionRecords).set({ revokedAt: new Date() }).where(eq(sessionRecords.childProfileId, childProfileId));
    await tx.update(childProfiles).set({ parentAccountId: null, cloudSyncEnabled: false, updatedAt: new Date() }).where(eq(childProfiles.id, childProfileId));
  });
  await recordAudit({ parentAccountId, childProfileId, actorType: 'parent', action: 'child-unlinked', resourceType: 'child-profile', resourceId: childProfileId });
  return response.status(204).end();
});

app.delete('/v1/account', requireSession('parent'), async (request, response) => {
  const parsed = z.object({ confirmation: z.literal('DELETE GLITTER ACCOUNT') }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Type DELETE GLITTER ACCOUNT to confirm.' });
  if (!db) return response.status(503).json({ error: 'Cloud deletion is not configured.' });
  const parentAccountId = request.session!.subject;
  const deleted = await db.delete(parentAccounts).where(eq(parentAccounts.id, parentAccountId)).returning({ id: parentAccounts.id });
  return deleted.length ? response.status(204).end() : response.status(404).json({ error: 'Account not found.' });
});

const webRoot = path.resolve(process.cwd(), 'dist');
if (existsSync(webRoot)) {
  app.use(express.static(webRoot, { index: false, maxAge: config.NODE_ENV === 'production' ? '1h' : 0 }));
}
app.use((request, response) => {
  if (request.accepts('html')) {
    const staticPage = resolveStaticPage(webRoot, request.path);
    if (staticPage.startsWith(webRoot) && existsSync(staticPage)) return response.sendFile(staticPage);
    if (existsSync(path.join(webRoot, 'index.html'))) return response.sendFile(path.join(webRoot, 'index.html'));
  }
  return response.status(404).json({ error: 'Not found' });
});
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  if (config.NODE_ENV !== 'test') console.error('[avacado-api]', message);
  response.status(500).json({ error: 'The request could not be completed.' });
});

export { app };
