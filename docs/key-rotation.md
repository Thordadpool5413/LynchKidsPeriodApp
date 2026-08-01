# Encryption Key Rotation

Child profile payloads (`child_profiles.encrypted_profile`) and sync records
(`sync_records.encrypted_payload`) are encrypted at rest using AES-256-GCM
with a key stored in the `FIELD_ENCRYPTION_KEY` environment secret.

This document explains what happens when the key must be changed — due to
suspected compromise, routine security policy, or a configuration error — and
how to rotate it safely without losing data.

---

## How key versioning works

Each encrypted blob stored in the database has the shape:

```json
{
  "version": 1,
  "keyVersion": 2,
  "iv": "…",
  "tag": "…",
  "ciphertext": "…"
}
```

`keyVersion` identifies which encryption key was used.  The active key is set
via the `FIELD_ENCRYPTION_KEY` environment secret and may carry an optional
version prefix:

| Format | Key version | Notes |
|---|---|---|
| `BASE64_32_BYTES` | 1 (implicit) | Legacy — no prefix |
| `v1:BASE64_32_BYTES` | 1 | Explicit version 1 |
| `v2:BASE64_32_BYTES` | 2 | Version 2, etc. |

The rotation script uses the `keyVersion` field to skip rows that are already
on the current key, so rotation is safe to re-run and can be done
incrementally in large databases.

---

## Generating a new key

```bash
# Print a 32-byte key ready to use as v2:
echo "v2:$(openssl rand -base64 32 | tr -d '\n')"
```

Store the output as the new value of `FIELD_ENCRYPTION_KEY` in Replit Secrets
(or your secrets manager).  Keep the old key value — you will need it for the
rotation script.

---

## Step-by-step rotation procedure

### 1. Prepare both keys

Make sure you have:

- **New key** — the value you will set for `FIELD_ENCRYPTION_KEY` going
  forward (e.g. `v2:NEW_BASE64`).
- **Old key** — the current value of `FIELD_ENCRYPTION_KEY` before the
  rotation (e.g. `v1:OLD_BASE64`).

### 2. Run the rotation script in dry-run mode

```bash
FIELD_ENCRYPTION_KEY="v2:NEW_BASE64" \
FIELD_ENCRYPTION_KEY_PREVIOUS="v1:OLD_BASE64" \
DATABASE_URL="$DATABASE_URL" \
npx tsx server/scripts/rotate-encryption-key.ts --dry-run
```

The script will print the number of rows it _would_ re-encrypt without writing
anything.  Verify the counts look right.

### 3. Put the API server in maintenance mode (optional but recommended)

For a zero-data-loss rotation on a live production database, prevent new writes
while re-encryption is in progress.  A short maintenance window (< 1 minute
for typical databases) is sufficient.

### 4. Run the rotation for real

```bash
FIELD_ENCRYPTION_KEY="v2:NEW_BASE64" \
FIELD_ENCRYPTION_KEY_PREVIOUS="v1:OLD_BASE64" \
DATABASE_URL="$DATABASE_URL" \
npx tsx server/scripts/rotate-encryption-key.ts
```

The script exits with code `0` on success and `1` if any rows could not be
re-encrypted (check stderr for details).

### 5. Update `FIELD_ENCRYPTION_KEY` in production

Set `FIELD_ENCRYPTION_KEY` to the new key in Replit Secrets and restart the
API server:

```
FIELD_ENCRYPTION_KEY=v2:NEW_BASE64
```

The old key value is no longer needed once all rows have been re-encrypted.

### 6. Verify

Confirm that the application can read child profiles and sync records without
error.  Any row that could not be re-encrypted will produce a `DecryptionError`
with a clear message pointing to this document.

---

## What happens when decryption fails

If the active key cannot decrypt a stored blob — for example because the key
was changed without running the rotation script — the server throws a
`DecryptionError` with a message like:

```
Failed to decrypt field (blob was encrypted with key version 1).
If the encryption key was rotated, run the key-rotation script to
re-encrypt existing rows. See docs/key-rotation.md for instructions.
```

This is a loud, explicit failure rather than a silent `null` return, so the
problem is immediately visible in logs rather than silently corrupting user
data.

---

## Security notes

- Never commit key material to source control.
- Keep the old key accessible only long enough to run the rotation script.
- After a suspected key compromise, rotate immediately and audit
  `audit_events` for unusual read patterns before the rotation date.
