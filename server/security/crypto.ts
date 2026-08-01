import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config';

interface EncryptedField { version: 1; iv: string; tag: string; ciphertext: string }

function key(): Buffer {
  if (!config.FIELD_ENCRYPTION_KEY) {
    if (config.NODE_ENV === 'production') throw new Error('FIELD_ENCRYPTION_KEY is required');
    return Buffer.alloc(32, 7);
  }
  const decoded = Buffer.from(config.FIELD_ENCRYPTION_KEY, 'base64');
  if (decoded.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  return decoded;
}

export function encryptField(value: unknown): EncryptedField {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

export function decryptField<T>(value: EncryptedField): T {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}
