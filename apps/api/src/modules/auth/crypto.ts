import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const KEY_LEN = 32;
const IV_LEN = 12;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LEN, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function getKeyMaterial(secret: string): Buffer {
  // Anchor: project docs call for AES-256 with the configured secret.
  // Use scrypt to stretch the secret into a 32-byte key.
  const salt = Buffer.from('modelharbor:encryption:v1', 'utf8');
  return scryptSync(secret, salt, KEY_LEN, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export interface EncryptResult {
  ciphertext: string;
  prefix: string;
}

export function encryptSecret(plaintext: string, secretKey: string): EncryptResult {
  const key = deriveKey(secretKey, Buffer.from('modelharbor:enc:v1', 'utf8'));
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString('base64');
  return { ciphertext: payload, prefix: plaintext.slice(0, 4) };
}

export function decryptSecret(payload: string, secretKey: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + 16) {
    throw new Error('ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const key = deriveKey(secretKey, Buffer.from('modelharbor:enc:v1', 'utf8'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

// Constant-time compare to avoid timing attacks on signature/HMAC checks
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function randomBase64Url(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url');
}
