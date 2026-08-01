---
name: Glitter dev setup on Replit
description: How the Expo web app and Express API are wired together for development, and key quirks found during setup.
---

## Dev architecture

- **Expo web** runs on port 5000 (webview workflow, `npx expo start --web --port 5000`)
- **Express API** runs on port 3000 (console workflow, `PORT=3000 npm run api`)
- **metro.config.js** proxies `/v1/*` and `/healthz` from port 5000 → 3000 so the browser stays on one origin and CORS is never an issue. `EXPO_PUBLIC_API_URL` stays empty; relative URLs work.

**Why proxy instead of setting EXPO_PUBLIC_API_URL:** Replit's dev domain for port 5000 is the `REPLIT_DEV_DOMAIN` env var. Other ports use different subdomains that aren't predictable without runtime inspection. The proxy avoids all of this and matches production behaviour (where the API and static site share one server).

## PUBLIC_APP_URL

`server/config.ts` falls back to `https://${REPLIT_DEV_DOMAIN}` when `PUBLIC_APP_URL` is not set. This controls CORS and magic-link redirect URLs. In production, set `PUBLIC_APP_URL` explicitly.

## expo-sqlite WASM issue (RESOLVED)

`expo-sqlite` with `useSQLCipher: true` causes Metro to fail because its web worker imports `wa-sqlite.wasm`. Fix: add `config.resolver.assetExts.push('wasm')` in `metro.config.js`. The WASM file exists in `node_modules/expo-sqlite/web/wa-sqlite/`.

## Multi-merge node_modules corruption

When several task branches merge in rapid succession, `npm ci` runs overlap and can corrupt `node_modules/@babel/core/lib/config/files`. Fix: run `npm ci` manually and restart the `Start application` workflow.

## Post-merge script

`scripts/post-merge.sh` runs `npm ci` after every merge. Configured with 120 s timeout.
