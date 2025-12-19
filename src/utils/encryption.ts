/**
 * Encryption utilities for private key storage
 * Uses Web Crypto API with AES-GCM for secure at-rest encryption
 */

/**
 * Derive encryption key from passphrase using PBKDF2
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Ensure salt is ArrayBufferView for TypeScript
  const saltView = new Uint8Array(salt);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltView,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt private key with passphrase
 * Returns: { salt, iv, ciphertext } as base64 strings
 */
export async function encryptPrivateKey(
  privateKey: string,
  passphrase: string
): Promise<{ salt: string; iv: string; ciphertext: string }> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Encrypt private key
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(privateKey);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintext
  );

  // Convert to base64 for storage
  return {
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

/**
 * Decrypt private key with passphrase
 */
export async function decryptPrivateKey(
  encrypted: { salt: string; iv: string; ciphertext: string },
  passphrase: string
): Promise<string> {
  try {
    // Decode base64
    const salt = Uint8Array.from(atob(encrypted.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(
      atob(encrypted.ciphertext),
      c => c.charCodeAt(0)
    );

    // Derive key from passphrase
    const key = await deriveKey(passphrase, salt);

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    throw new Error('Failed to decrypt: Invalid passphrase or corrupted data');
  }
}

