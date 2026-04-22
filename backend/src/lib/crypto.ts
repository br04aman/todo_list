import crypto from 'crypto';

// ChaCha20-Poly1305 Authenticated Encryption
// Key must be 32 bytes (256-bit), stored in env var CHACHA20_KEY as hex
const ALGORITHM = 'chacha20-poly1305';
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;  // 96-bit nonce for ChaCha20-Poly1305
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hexKey = process.env.CHACHA20_KEY;
  if (!hexKey) {
    throw new Error('CHACHA20_KEY environment variable is not set');
  }
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`CHACHA20_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
  }
  return key;
}

/**
 * Encrypt plaintext using ChaCha20-Poly1305
 * Returns: base64-encoded string of (nonce + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Pack: nonce (12) + authTag (16) + ciphertext (variable)
  const packed = Buffer.concat([nonce, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a ChaCha20-Poly1305 encrypted string
 * Input: base64-encoded string of (nonce + authTag + ciphertext)
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const packed = Buffer.from(encryptedBase64, 'base64');
  
  // Unpack
  const nonce = packed.subarray(0, NONCE_LENGTH);
  const authTag = packed.subarray(NONCE_LENGTH, NONCE_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(NONCE_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Generate a new random 256-bit key as hex string
 * Run once to generate your CHACHA20_KEY env var
 */
export function generateKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
