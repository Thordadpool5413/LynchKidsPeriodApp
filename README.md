# Glitter

Glitter is a privacy-first period companion for pre-teens. This repository contains a universal Expo application for iPhone, iPad, and web plus a Replit-ready TypeScript API and PostgreSQL schema.

## What is implemented

- Three-step child-readable onboarding
- “Hey girl, how are you feeling?” mood and symptom check-in
- Period start/day/end tracking with editable monthly calendar
- Careful cycle estimates with confidence language
- Unlimited local journal with per-entry grown-up sharing controls
- Education library, completion progress, and safety guidance
- Discreet native reminder infrastructure
- Non-punitive sticker achievements and Plus collections
- Glitter Plus paywall and seven-day local preview
- Ask Glitter curated search with fixed urgent-risk escalation
- Guided breathing activity and school-confidence toolkit
- Adult gate and one-child parent-support dashboard
- Plain-language privacy, local export, and device-data deletion
- Typed API, authorization, rate limiting, encrypted sync payloads, PostgreSQL schema, Stripe checkout/webhook contracts, entitlement states, and health endpoint
- EAS development/preview/production profiles and GitHub CI

## Run in Replit

1. Import this folder or its Git repository into Replit.
2. Choose Node.js 22.
3. In Shell, run `npm ci`.
4. Press **Run**. `.replit` starts the Expo web app and API together.
5. Open the web preview, or scan Expo’s QR code with Expo Go during the early UI phase.

Useful commands:

```bash
npm run web          # universal app in a browser
npm run start        # Expo QR/device development
npm run api          # API with reload
npm run dev          # web app and API together
npm run check        # TypeScript and tests
npm run web:export   # production site in dist/
```

The production API also serves `dist/`, allowing one Replit deployment to host both the website and `/v1` routes:

```bash
npm run web:export
npm run api:start
```

## Replit Secrets

Copy the names from `.env.example` into Replit Secrets. Never commit values.

Required for a production backend:

- `DATABASE_URL`
- `SESSION_SECRET` with at least 32 random characters
- `FIELD_ENCRYPTION_KEY`, exactly 32 random bytes encoded as base64
- `PUBLIC_APP_URL`

Stripe requires its secret key, signed-webhook secret, and monthly/annual Price IDs. Generative Ask Glitter additionally requires an OpenAI API key, approved Zero Data Retention, and both AI flags set to `true`.

## Database

The Drizzle schema includes parent accounts, one-child profiles, consent records, encrypted synchronized records, explicit share grants, subscription entitlements, aggregate AI usage, audit events, and idempotent webhook receipts.

```bash
npm run db:generate
npm run db:migrate
```

Local development intentionally runs without PostgreSQL. `/healthz` reports `database: false`, cloud writes return a safe `503`, and child data stays on the device.

## Subscriptions

The UI defines Glitter Plus at $4.99 monthly or $39.99 annually with a seven-day trial. Web checkout is credential-gated through Stripe. The local “Start 7-day preview” button is visibly a developer preview and does not claim a real purchase.

Before selling on iOS:

1. Create one subscription group and monthly/annual products in App Store Connect.
2. Add a StoreKit 2-compatible Expo native purchase module.
3. Implement Apple signed-transaction verification and App Store Server Notifications. The current Apple webhook returns `501` so an unverified event can never grant access.
4. Replace the preview button with a parental-gated native purchase sheet, Restore Purchases, and Manage Subscription.
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
- Implement production email sign-in, re-authenticated cloud export/deletion, and Apple transaction verification.
- Complete the encrypted native SQLite key lifecycle. The SQLCipher build flag is configured, while this development UI still uses the Expo SQLite localStorage adapter for fast Expo/web iteration.
- Replace the prototype cloud-sharing toggle with the verified consent and device-link flow.
- Audit native dependency privacy manifests and complete App Store privacy/age-rating disclosures.

Glitter provides general education. It does not diagnose, prescribe, provide telehealth, or replace emergency or professional care.
