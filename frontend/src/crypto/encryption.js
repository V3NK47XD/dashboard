/**
 * Hardware-Accelerated AES-GCM Client-Side Encryption
 * 
 * Uses the native Web Crypto API (SubtleCrypto) for high-throughput,
 * zero-dependency 256-bit AES-GCM encryption with PBKDF2 key derivation.
 * 
 * Supports:
 * - Password encryption & decryption with authenticated integrity check
 * - Password verification
 * - "No encryption" plaintext envelope mode
 * - Fast Base64 encoding/decoding for Uint8Arrays
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12; // Standard 96-bit IV for AES-GCM

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not supported in this environment');
}

/**
 * Convert a Uint8Array to a Base64 string
 */
export function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Base64 string to a Uint8Array
 */
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
 * Derive an AES-GCM 256-bit CryptoKey from a password and salt using PBKDF2
 */
async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plain JavaScript object/value with a password
 * Returns an envelope object ready for JSON serialization
 */
export async function encryptPayload(data, password) {
  if (!password) {
    throw new Error('Password is required for encryption');
  }

  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);

  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintextBytes
  );

  const ciphertextBytes = new Uint8Array(cipherBuffer);

  return {
    version: 1,
    encrypted: true,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(ciphertextBytes),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Decrypt an envelope object with a password
 * Returns the parsed plain JavaScript object
 */
export async function decryptPayload(envelope, password) {
  if (!envelope) {
    throw new Error('Empty envelope provided for decryption');
  }

  // If not encrypted, return the unencrypted data payload directly
  if (!envelope.encrypted) {
    return envelope.data !== undefined ? envelope.data : envelope;
  }

  if (!password) {
    const err = new Error('Password required to decrypt data');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }

  try {
    const crypto = getCrypto();
    const salt = base64ToUint8Array(envelope.salt);
    const iv = base64ToUint8Array(envelope.iv);
    const ciphertext = base64ToUint8Array(envelope.ciphertext);
    const iterations = envelope.iterations || PBKDF2_ITERATIONS;

    const key = await deriveKey(password, salt, iterations);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);
    return JSON.parse(jsonString);
  } catch (err) {
    const decryptError = new Error('Incorrect password or corrupted data');
    decryptError.code = 'INVALID_PASSWORD';
    decryptError.originalError = err;
    throw decryptError;
  }
}

/**
 * Verify whether a given password correctly decrypts an envelope
 */
export async function verifyPassword(envelope, password) {
  if (!envelope || !envelope.encrypted) return true;
  try {
    await decryptPayload(envelope, password);
    return true;
  } catch {
    return false;
  }
}

/**
 * Package data into either an encrypted or plaintext envelope based on encryptionMode
 * encryptionMode: 'password' | 'none'
 */
export async function packageEnvelope(data, encryptionMode, password) {
  if (encryptionMode === 'password' && password) {
    return await encryptPayload(data, password);
  }

  // Plaintext envelope
  return {
    version: 1,
    encrypted: false,
    algorithm: 'none',
    data: data,
    updated_at: new Date().toISOString(),
  };
}
