# Glitter

Glitter is a privacy-first period companion for pre-teens. This repository contains a universal Expo application for iPhone, iPad, and web plus a Replit-ready TypeScript API and PostgreSQL schema.

## What is implemented

- Three-step child-readable onboarding
- “Hey girl, how are you feeling?” mood and symptom check-in
- Period start/day/end tracking with editable monthly calendar
- Careful cycle estimates with confidence language
- Unlimited local journal with per-entry grown-up sharing controls
- Education library, completion progress, and safety guidance
- Forecast-relative local reminders plus generic parent push-job infrastructure
- Non-punitive sticker achievements and Plus collections
- Glitter Plus paywall; developer-only preview entitlements are stripped from production builds
- Ask Glitter curated search with fixed urgent-risk escalation
- Garden Builder, Comfort Match, Learning Quest, guided breathing, and school-confidence tools
- Parent email magic links, verified-consent proof gate, one-time child-device codes, revocable sessions, and a one-child support dashboard
- Plus Care Requests with structured supply/comfort/school choices, optional encrypted 120-character notes, fixed parent replies, 24-hour expiry, offline retry, and a free urgent check-on-me action
- Plain-language privacy, local export, and device-data deletion
- Typed API, authorization, rate limiting, encrypted sync payloads, PostgreSQL migrations, Resend email, Stripe webhooks, verified Apple V2 server notifications, normalized entitlements, Expo push receipts, and health endpoint
- EAS development/preview/production profiles and GitHub CI

## Run in Replit

1. Import this folder or its Git repository into Replit.
2. Choose Node.js 22.
3. In Shell, run `npm ci`.
4. Press **Run**. `.replit` starts the Expo web app and API together.
5. Open the web preview. Expo Go remains useful for ordinary UI work; StoreKit and encrypted native database release testing require a development build.

Useful commands:

```bash
npm run web          # universal app in a browser
npm run start        # Expo QR/device development
npm run api          # API with reload
npm run dev          # web app and API together
npm run check        # TypeScript and tests
npm run web:export   # production site in dist/
npm run notifications:send # scheduled push/expiry/receipt worker
```

The production API also serves `dist/`, allowing one Replit deployment to host both the website and `/v1` routes:

```bash
npm ci && npm run web:export
NODE_ENV=production npm run api:production
```

Create a separate Replit Scheduled Deployment that runs `npm run notifications:send` every few minutes. The worker is idempotent: it expires old requests, rechecks consent and Plus access, sends due generic notifications, retries transient failures, inspects Expo receipts, and revokes unregistered devices.

## Replit Secrets

Copy the names from `.env.example` into Replit Secrets. Never commit values.

Required for a production backend:

- `DATABASE_URL`
- `SESSION_SECRET` with at least 32 random characters
- `FIELD_ENCRYPTION_KEY`, exactly 32 random bytes encoded as base64
- `PUBLIC_APP_URL`
- `RESEND_API_KEY` and `PARENT_EMAIL_FROM`
- `VPC_PROVIDER_ENABLED=true` and a 32+ character `VPC_PROVIDER_SECRET`
- `EXPO_ACCESS_TOKEN`
- Stripe secret, signed-webhook secret, and monthly/annual Price IDs
- Apple root CA certificates (comma-separated base64), App ID, bundle ID, and monthly/annual product IDs

Stripe requires its secret key, signed-webhook secret, and monthly/annual Price IDs. Generative Ask Glitter additionally requires an OpenAI API key, approved Zero Data Retention, and both AI flags set to `true`.

## Database

The committed Drizzle migrations create 18 tables for parent/child identity, magic links, revocable sessions, consent, one-time link codes, encrypted synchronization, explicit share grants, devices, reminder preferences, forecasts, Care Requests and replies, notification jobs, subscription entitlements, aggregate AI usage, audit events, and idempotent webhook receipts.

```bash
npm run db:generate
npm run db:migrate
```

`api:production` validates required secrets, applies committed migrations, checks the database, starts the server, and verifies `/healthz`. Any failed step exits the deployment.

Local development intentionally runs without PostgreSQL. `/healthz` reports `database: false`, cloud writes return a safe `503`, and child data stays on the device.

## Subscriptions

The UI defines Glitter Plus at $4.99 monthly or $39.99 annually with a seven-day trial. Web checkout is credential-gated through Stripe. A local preview exists only in developer builds; production removes or ignores preview entitlements. Apple V2 notifications and signed transactions are verified with Apple’s official Node server library before entitlement changes.

Before selling on iOS:

1. Create one subscription group and monthly/annual products in App Store Connect.
2. Add and test a StoreKit 2-compatible Expo native purchase module in a development build.
3. Configure Apple root certificates and product IDs, then test the implemented V2 verification endpoint with Apple test notifications.
4. Connect the parental-gated native purchase sheet, Restore Purchases, and Manage Subscription to the verified entitlement API.
5. Test purchase, restore, trial, renewal, grace, billing retry, refund, and revocation in StoreKit sandbox/TestFlight.

## Ask Glitter safety

Ask Glitter currently searches only the bundled education catalog. Urgent or medication/diagnosis language bypasses search and returns fixed trusted-adult or emergency guidance. Prompts are not persisted.

Generative mode remains off unless:

- `OPENAI_ZDR_APPROVED=true`
- `ASK_BLOOM_GENERATIVE_ENABLED=true`
- `OPENAI_API_KEY` is configured
- legal, clinical, and red-team approval are complete

When enabled, the server uses `store: false`, sends no child profile or cycle history, and provides only matched reviewed content as context.

## Privacy and safety limitations

This is a functional product implementation, not a claim of legal or clinical approval. Before release:

- Replace all `reviewerStatus: "draft"` health content with documented clinician-reviewed versions.
- Complete COPPA/verifiable-parental-consent and applicable state health-data review.
- Select and legally approve a verifiable-parental-consent provider that can issue the implemented signed proof contract; email sign-in is not consent.
- Complete re-authentication UX immediately before destructive cloud-account deletion.
- Complete the encrypted native SQLite key lifecycle. The SQLCipher build flag is configured, while this development UI still uses the Expo SQLite localStorage adapter for fast Expo/web iteration.
- Remove the developer-only cloud-sharing switch after the verified provider flow is connected end to end.
- Audit native dependency privacy manifests and complete App Store privacy/age-rating disclosures.

Glitter provides general education. It does not diagnose, prescribe, provide telehealth, or replace emergency or professional care.
