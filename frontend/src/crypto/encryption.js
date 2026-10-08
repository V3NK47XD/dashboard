/**
 * Hardware-Accelerated AES-GCM Client-Side Record Encryption
 * 
 * Provides individual record value encryption for tasks, thoughts, and habits:
 * - Fixed overall JSON document structure
 * - Only sensitive record values are encrypted (enc:v1:salt:iv:ciphertext)
 * - Cached PBKDF2 key derivation for sub-millisecond batch operations
 * - Transparent support for "No Encryption" plaintext mode
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12; // Standard 96-bit IV for AES-GCM

// Key cache: `${password}:${saltBase64}` -> CryptoKey
const keyCache = new Map();

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not supported in this environment');
}

export function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a new random Base64 salt
 */
export function generateSalt() {
  const crypto = getCrypto();
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  return uint8ArrayToBase64(saltBytes);
}

/**
 * Derive an AES-GCM 256-bit CryptoKey with caching
 */
export async function getDerivedKey(password, saltBase64) {
  if (!password) {
    throw new Error('Password is required to derive key');
  }

  const cacheKey = `${password}:${saltBase64}`;
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey);
  }

  const crypto = getCrypto();
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBytes = base64ToUint8Array(saltBase64);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

/**
 * Encrypt an individual record value (string or object)
 * Returns a compact token: `enc:v1:<salt>:<iv>:<ciphertext>`
 */
export async function encryptRecordValue(value, password, preferredSalt = null) {
  if (!password) {
    // Unencrypted mode: return raw value
    return value;
  }

  const crypto = getCrypto();
  const saltBase64 = preferredSalt || generateSalt();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const key = await getDerivedKey(password, saltBase64);

  const enc = new TextEncoder();
  const plaintext = typeof value === 'string' ? value : JSON.stringify(value);
  const plaintextBytes = enc.encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintextBytes
  );

  const ivBase64 = uint8ArrayToBase64(iv);
  const cipherBase64 = uint8ArrayToBase64(new Uint8Array(cipherBuffer));

  return `enc:v1:${saltBase64}:${ivBase64}:${cipherBase64}`;
}

/**
 * Decrypt an individual record value
 * If not encrypted (no `enc:v1:` prefix), returns the value as-is.
 */
export async function decryptRecordValue(token, password) {
  if (typeof token !== 'string' || !token.startsWith('enc:v1:')) {
    return token;
  }

  if (!password) {
    const err = new Error('Password required to decrypt record');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }

  const parts = token.split(':');
  if (parts.length < 5) {
    throw new Error('Malformed encrypted record format');
  }

  const [, , saltBase64, ivBase64, cipherBase64] = parts;

  try {
    const key = await getDerivedKey(password, saltBase64);
    const iv = base64ToUint8Array(ivBase64);
    const ciphertext = base64ToUint8Array(cipherBase64);

    const crypto = getCrypto();
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const rawString = dec.decode(decryptedBuffer);

    // Try parsing as JSON object/array if applicable
    if ((rawString.startsWith('{') && rawString.endsWith('}')) || (rawString.startsWith('[') && rawString.endsWith(']'))) {
      try {
        return JSON.parse(rawString);
      } catch {
        return rawString;
      }
    }
    return rawString;
  } catch (err) {
    const decErr = new Error('Incorrect password or corrupted record');
    decErr.code = 'INVALID_PASSWORD';
    decErr.originalError = err;
    throw decErr;
  }
}

/**
 * Verify a master password against a test token or record
 */
export async function verifyRecordPassword(token, password) {
  if (typeof token !== 'string' || !token.startsWith('enc:v1:')) {
    return true;
  }
  try {
    await decryptRecordValue(token, password);
    return true;
  } catch {
    return false;
  }
}
