import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config';

/**
 * Versioned encrypted field stored as JSONB.
 *
 * `keyVersion` identifies which key encrypted this blob so that a rotation
 * script can re-encrypt only the rows that still use an old key version.
 * Blobs written before key-versioning was introduced will be missing this
 * field; they were encrypted with whatever key was active at write time.
 */
export interface EncryptedField {
  version: 1;
  keyVersion: number;
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * Thrown when decryption fails because the active key cannot authenticate the
 * ciphertext.  This happens when:
 *   - FIELD_ENCRYPTION_KEY has been rotated without re-encrypting existing rows
 *   - FIELD_ENCRYPTION_KEY is missing or wrong in this environment
 *   - The stored blob has been tampered with
 */
export class DecryptionError extends Error {
  constructor(
    public readonly keyVersion: number | undefined,
    cause: unknown,
  ) {
    const hint =
      keyVersion !== undefined
        ? ` (blob was encrypted with key version ${keyVersion})`
        : ' (blob has no key version — it predates versioning)';
    super(
      `Failed to decrypt field${hint}. ` +
        'If the encryption key was rotated, run the key-rotation script to re-encrypt existing rows. ' +
        'See docs/key-rotation.md for instructions.',
      { cause },
    );
    this.name = 'DecryptionError';
  }
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Parse a raw env-var value into { version, keyBuffer }.
 *
 * Accepted formats:
 *   v2:BASE64_32_BYTES   — explicit version prefix
 *   BASE64_32_BYTES      — legacy / no prefix → treated as version 1
 */
function parseKeyString(raw: string): { version: number; keyBuffer: Buffer } {
  const prefixed = /^v(\d+):(.+)$/.exec(raw);
  if (prefixed) {
    const version = parseInt(prefixed[1], 10);
    const decoded = Buffer.from(prefixed[2], 'base64');
    if (decoded.length !== 32)
      throw new Error(
        `FIELD_ENCRYPTION_KEY (v${version}) must be 32 bytes encoded as base64`,
      );
    return { version, keyBuffer: decoded };
  }
  // Legacy: no version prefix → version 1
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32)
    throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  return { version: 1, keyBuffer: decoded };
}

let _keyCache: { version: number; keyBuffer: Buffer } | null = null;

function activeKey(): { version: number; keyBuffer: Buffer } {
  if (_keyCache) return _keyCache;

  if (!config.FIELD_ENCRYPTION_KEY) {
    if (config.NODE_ENV === 'production')
      throw new Error('FIELD_ENCRYPTION_KEY is required');
    // Development fallback: deterministic 32-byte buffer
    _keyCache = { version: 0, keyBuffer: Buffer.alloc(32, 7) };
    return _keyCache;
  }

  _keyCache = parseKeyString(config.FIELD_ENCRYPTION_KEY);
  return _keyCache;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function encryptField(value: unknown): EncryptedField {
  const { version, keyBuffer } = activeKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    keyVersion: version,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptField<T>(value: EncryptedField): T {
  const { keyBuffer } = activeKey();
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyBuffer,
      Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString('utf8')) as T;
  } catch (err) {
    throw new DecryptionError(value.keyVersion, err);
  }
}

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
