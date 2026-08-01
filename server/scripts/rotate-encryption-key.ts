/**
 * Key-rotation script for FIELD_ENCRYPTION_KEY.
 *
 * Re-encrypts every child_profiles.encrypted_profile and
 * sync_records.encrypted_payload row that was encrypted with an old key
 * version, writing them back encrypted with the current active key.
 *
 * Usage
 * -----
 *   # 1. Set the NEW key as the active key (with a version prefix):
 *   export FIELD_ENCRYPTION_KEY="v2:$(openssl rand -base64 32 | tr -d '\n')"
 *
 *   # 2. Set the OLD key so this script can still decrypt existing rows:
 *   export FIELD_ENCRYPTION_KEY_PREVIOUS="v1:OLD_BASE64_KEY_HERE"
 *
 *   # 3. Run (dry-run first to preview what will be touched):
 *   npx tsx server/scripts/rotate-encryption-key.ts --dry-run
 *
 *   # 4. Run for real:
 *   npx tsx server/scripts/rotate-encryption-key.ts
 *
 * See docs/key-rotation.md for the full procedure.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, isNull } from 'drizzle-orm';
import { childProfiles, syncRecords } from '../db/schema';
import type { EncryptedField } from '../security/crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const DATABASE_URL = process.env.DATABASE_URL;
const NEW_KEY_RAW = process.env.FIELD_ENCRYPTION_KEY;
const OLD_KEY_RAW = process.env.FIELD_ENCRYPTION_KEY_PREVIOUS;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}
if (!NEW_KEY_RAW) {
  console.error('ERROR: FIELD_ENCRYPTION_KEY is not set');
  process.exit(1);
}
if (!OLD_KEY_RAW) {
  console.error(
    'ERROR: FIELD_ENCRYPTION_KEY_PREVIOUS is not set.\n' +
      'Set it to the key that was active BEFORE the rotation (e.g. v1:OLD_BASE64).',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Key parsing helpers (standalone — no dependency on server/config)
// ---------------------------------------------------------------------------

function parseKey(raw: string, label: string): { version: number; buf: Buffer } {
  const prefixed = /^v(\d+):(.+)$/.exec(raw);
  if (prefixed) {
    const version = parseInt(prefixed[1], 10);
    const buf = Buffer.from(prefixed[2], 'base64');
    if (buf.length !== 32)
      throw new Error(`${label}: must be 32 bytes base64 (got ${buf.length})`);
    return { version, buf };
  }
  // Legacy: no version prefix → version 1
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32)
    throw new Error(`${label}: must be 32 bytes base64 (got ${buf.length})`);
  return { version: 1, buf };
}

const newKey = parseKey(NEW_KEY_RAW, 'FIELD_ENCRYPTION_KEY');
const oldKey = parseKey(OLD_KEY_RAW, 'FIELD_ENCRYPTION_KEY_PREVIOUS');

if (newKey.version === oldKey.version) {
  console.error(
    `ERROR: New key and old key have the same version (${newKey.version}).\n` +
      'The new key must have a higher version number (e.g. v2:... if old was v1:...).',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt with explicit key buffer
// ---------------------------------------------------------------------------

function decrypt(blob: EncryptedField, keyBuf: Buffer): unknown {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyBuf,
    Buffer.from(blob.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString('utf8'));
}

function encrypt(value: unknown, keyVersion: number, keyBuf: Buffer): EncryptedField {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    keyVersion,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  console.log(`\nKey rotation script`);
  console.log(`  Old key version : ${oldKey.version}`);
  console.log(`  New key version : ${newKey.version}`);
  console.log(`  Dry run         : ${DRY_RUN ? 'YES — no writes will be made' : 'NO'}\n`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  let rotatedProfiles = 0;
  let rotatedSyncRecords = 0;
  let errors = 0;

  // --- child_profiles ---
  console.log('Processing child_profiles…');
  const profiles = await db
    .select({ id: childProfiles.id, encryptedProfile: childProfiles.encryptedProfile })
    .from(childProfiles)
    .where(isNull(childProfiles.deletedAt));

  for (const row of profiles) {
    const blob = row.encryptedProfile as EncryptedField;
    // Skip rows already on the new key version
    if (blob.keyVersion === newKey.version) continue;

    let plaintext: unknown;
    try {
      plaintext = decrypt(blob, oldKey.buf);
    } catch (err) {
      console.error(
        `  [ERROR] child_profiles id=${row.id}: decrypt failed — ` +
          (err instanceof Error ? err.message : String(err)),
      );
      errors++;
      continue;
    }

    const reEncrypted = encrypt(plaintext, newKey.version, newKey.buf);
    if (!DRY_RUN) {
      await db
        .update(childProfiles)
        .set({ encryptedProfile: reEncrypted })
        .where(eq(childProfiles.id, row.id));
    }
    rotatedProfiles++;
    if (DRY_RUN) console.log(`  [DRY] would rotate child_profiles id=${row.id}`);
  }

  // --- sync_records ---
  console.log('Processing sync_records…');
  const syncs = await db
    .select({ id: syncRecords.id, encryptedPayload: syncRecords.encryptedPayload })
    .from(syncRecords)
    .where(isNull(syncRecords.deletedAt));

  for (const row of syncs) {
    const blob = row.encryptedPayload as EncryptedField;
    if (blob.keyVersion === newKey.version) continue;

    let plaintext: unknown;
    try {
      plaintext = decrypt(blob, oldKey.buf);
    } catch (err) {
      console.error(
        `  [ERROR] sync_records id=${row.id}: decrypt failed — ` +
          (err instanceof Error ? err.message : String(err)),
      );
      errors++;
      continue;
    }

    const reEncrypted = encrypt(plaintext, newKey.version, newKey.buf);
    if (!DRY_RUN) {
      await db
        .update(syncRecords)
        .set({ encryptedPayload: reEncrypted })
        .where(eq(syncRecords.id, row.id));
    }
    rotatedSyncRecords++;
    if (DRY_RUN) console.log(`  [DRY] would rotate sync_records id=${row.id}`);
  }

  // --- Summary ---
  console.log('\n── Summary ──────────────────────────────────────');
  if (DRY_RUN) {
    console.log(`  Would rotate ${rotatedProfiles} child_profile row(s)`);
    console.log(`  Would rotate ${rotatedSyncRecords} sync_record row(s)`);
  } else {
    console.log(`  Rotated ${rotatedProfiles} child_profile row(s)`);
    console.log(`  Rotated ${rotatedSyncRecords} sync_record row(s)`);
  }
  if (errors > 0) {
    console.error(`  ERRORS: ${errors} row(s) could not be decrypted — check logs above.`);
    process.exitCode = 1;
  } else {
    console.log(`  No errors.`);
  }
  console.log('─────────────────────────────────────────────────\n');

  await pool.end();
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
