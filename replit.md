# Glitter

A privacy-first period companion for pre-teens built with Expo (React Native for iOS, Android, and web) plus a TypeScript/Express API and PostgreSQL schema.

## How to run on Replit

Two workflows are configured and start automatically:

| Workflow | Command | Port | Purpose |
|---|---|---|---|
| **Start application** | `npx expo start --web --port 5000` | 5000 | Expo web app (browser preview) |
| **Start Backend** | `PORT=3000 npm run api` | 3000 | TypeScript/Express API |

The web app runs fully offline in local mode — no database required. The API reports `database: false` at `/healthz` and gracefully skips cloud features until `DATABASE_URL` is set.

## Useful commands

```bash
npm run start        # Expo dev server with QR code (for Expo Go on a device)
npm run check        # TypeScript check + tests
npm run db:generate  # Drizzle schema → migration files
npm run db:migrate   # Apply migrations to the database
npm run web:export   # Build static site to dist/
npm run api:start    # Production API (also serves dist/)
```

## Environment secrets

`SESSION_SECRET` is already configured. For full backend functionality, add the rest via Replit Secrets:

| Secret | Required for |
|---|---|
| `DATABASE_URL` | Cloud sync, parent dashboard |
| `FIELD_ENCRYPTION_KEY` | Encrypted sync payloads (32 bytes, base64) |
| `PUBLIC_APP_URL` | Correct API redirect URLs |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / price IDs | Subscriptions |
| `OPENAI_API_KEY` | Generative Ask Ava (also requires `OPENAI_ZDR_APPROVED=true` and `ASK_BLOOM_GENERATIVE_ENABLED=true`) |

See `.env.example` for the full list.

## Metro config note

`metro.config.js` adds `.wasm` as an asset extension so that `expo-sqlite`'s web worker can bundle its WebAssembly file correctly.

## Stack

- **Frontend**: Expo SDK 54, React Native 0.81, Expo Router, React 19
- **Backend**: Express 5, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (optional for local dev)
- **Payments**: Stripe (web checkout contracts ready; iOS StoreKit 2 not yet implemented)

## User preferences

_Nothing recorded yet._
