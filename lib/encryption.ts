// lib/encryption.ts
// Handles bulletproof AES-256-GCM symmetric encryption/decryption for OAuth tokens.
// Validates ENCRYPTION_KEY at startup (fails fast) and appends random IVs and GCM authentication tags.

import crypto from 'crypto';

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const encryptionKeyHex = process.env.ENCRYPTION_KEY;
  if (!encryptionKeyHex) {
    throw new Error('CRITICAL SHIELD FAILURE: ENCRYPTION_KEY environment variable is not defined.');
  }

  const key = Buffer.from(encryptionKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `CRITICAL SHIELD FAILURE: ENCRYPTION_KEY must be exactly 32 bytes as a hex string. Current parsed length: ${key.length} bytes.`
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypts cleartext using AES-256-GCM.
 * Appends a randomized 12-byte IV and retrieves the 16-byte Auth Tag.
 * Returns format: ivHex:authTagHex:encryptedText
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts GCM-encrypted ciphertext.
 * Parses concatenated ivHex:authTagHex:encryptedText, checks tag validity, and recovers plain text.
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Security Refusal: Invalid encrypted credential format. Expected iv:authTag:ciphertext.');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
