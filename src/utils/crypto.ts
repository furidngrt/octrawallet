import nacl from 'tweetnacl';
import bs58 from 'bs58';

const MICRO_OCT = 1_000_000n; // Use BigInt for precision

/**
 * Octra Wallet Technical Specifications:
 * - Signature Algorithm: Ed25519 (via tweetnacl)
 * - Key Derivation: BIP39-compatible (PBKDF2-HMAC-SHA512, 2048 iterations)
 *   Note: This wallet accepts private keys directly (base64/hex).
 *         For mnemonic import, use BIP39 derivation first to get the 32-byte seed.
 * - Address Format: oct[base58(SHA256(public_key))]
 * - Key Format: 32-byte seed for Ed25519 key pair generation
 */

/**
 * Get signing key from private key (base64/hex)
 * The private key should be the 32-byte seed or secret key from BIP39 derivation
 */
function getSigningKey(privateKey: string): nacl.SignKeyPair {
  try {
    let keyBytes: Uint8Array;
    
    if (isBase64(privateKey)) {
      keyBytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
    } else if (privateKey.startsWith('0x')) {
      keyBytes = Uint8Array.from(privateKey.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      // Assume hex without 0x prefix
      keyBytes = Uint8Array.from(privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    }
    
    // tweetnacl: 32-byte seed -> use fromSeed, 64-byte secret -> use fromSecretKey
    // PyNaCl (pre-client) uses 32-byte keys, so we use fromSeed
    return keyBytes.length === 32
      ? nacl.sign.keyPair.fromSeed(keyBytes)
      : nacl.sign.keyPair.fromSecretKey(keyBytes);
  } catch (error) {
    throw new Error(`Failed to load signing key: ${error}`);
  }
}

/**
 * Derive address from private key
 * Address = oct[base58(SHA256(pubkey))]
 * Note: Octra uses SHA256 hash of public key, not the public key directly
 */
export async function privateKeyToAddress(privateKey: string): Promise<string> {
  try {
    const keyPair = getSigningKey(privateKey);
    const pubKeyBytes = keyPair.publicKey;
    
    // Create a new ArrayBuffer copy for crypto.subtle compatibility
    const pubKeyArray = Uint8Array.from(pubKeyBytes);
    
    // SHA256 hash the public key
    const hashBuffer = await crypto.subtle.digest('SHA-256', pubKeyArray.buffer);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Base58 encode the hash and add 'oct' prefix
    const encoded = bs58.encode(hashArray);
    return 'oct' + encoded;
  } catch (error) {
    throw new Error(`Failed to derive address from private key: ${error}`);
  }
}

/**
 * Convert OCT amount to raw microOCT units using BigInt for precision
 * Exported for use in transaction building
 */
export function amountToMicroOCT(amount: string): string {
  // Validate amount
  if (!amount || amount.trim() === '') {
    throw new Error('Amount cannot be empty');
  }

  const trimmed = amount.trim();
  
  // Check for invalid values
  if (trimmed === 'NaN' || trimmed === 'Infinity' || trimmed === '-Infinity') {
    throw new Error('Invalid amount: NaN or Infinity');
  }

  // Check for negative
  if (trimmed.startsWith('-')) {
    throw new Error('Amount cannot be negative');
  }

  // Parse decimal amount
  const parts = trimmed.split('.');
  if (parts.length > 2) {
    throw new Error('Invalid amount format');
  }

  const [whole, decimals = ''] = parts;
  
  // Validate whole part
  if (!/^\d+$/.test(whole)) {
    throw new Error('Invalid amount format');
  }

  // Validate decimals (max 6 digits for microOCT precision)
  if (decimals.length > 6) {
    throw new Error('Amount cannot have more than 6 decimal places');
  }

  if (decimals && !/^\d+$/.test(decimals)) {
    throw new Error('Invalid decimal format');
  }

  // Convert to microOCT using BigInt
  const wholeBigInt = BigInt(whole);
  const decimalsPadded = decimals.padEnd(6, '0').slice(0, 6);
  const decimalsBigInt = BigInt(decimalsPadded);
  
  const microOCT = wholeBigInt * MICRO_OCT + decimalsBigInt;
  
  return microOCT.toString();
}

/**
 * Sign transaction data locally (matching pre-client format)
 * Transaction is signed without "message" field, then signature and public_key added
 */
export function signTransactionData(
  privateKey: string,
  from: string,
  to: string,
  amount: string,
  nonce: number,
  timestamp: number
): { signature: string; publicKey: string } {
  try {
    const keyPair = getSigningKey(privateKey);
    
    // Convert amount to raw units (microOCT) using BigInt
    const amountRaw = amountToMicroOCT(amount);
    
    // OU: Server requires minimum 1000. Use "1000" for amounts < 1000 OCT, "3" for >= 1000 OCT
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || !isFinite(amountFloat)) {
      throw new Error('Invalid amount value');
    }
    const ou = amountFloat < 1000 ? "1000" : "3";
    
    // Create transaction object (without message, signature, public_key)
    // Order matches pre-client: from, to_, amount, nonce, ou, timestamp
    // CRITICAL: nonce is INT, timestamp is FLOAT (matching pre-client exactly)
    const txData = {
      from,
      to_: to,  // Note: it's "to_" not "to"
      amount: amountRaw,  // String from BigInt conversion
      nonce: nonce,  // INT
      ou,  // String "1" or "3"
      timestamp: timestamp  // FLOAT (Unix timestamp in seconds)
    };
    
    // Sign the JSON string (compact, no spaces - matching pre-client json.dumps separators=(",", ":"))
    const toSign = JSON.stringify(txData).replace(/\s+/g, '');
    const messageBytes = new TextEncoder().encode(toSign);
    const signatureBytes = nacl.sign.detached(messageBytes, keyPair.secretKey);
    
    // Base64 encode signature and public key
    const signature = btoa(String.fromCharCode(...signatureBytes));
    const publicKey = btoa(String.fromCharCode(...keyPair.publicKey));
    
    return { signature, publicKey };
  } catch (error) {
    throw new Error(`Failed to sign transaction: ${error}`);
  }
}

function isBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

/**
 * Validate private key format (ed25519 = 32 bytes)
 */
export function validatePrivateKey(key: string): boolean {
  try {
    let keyBytes: Uint8Array;
    
    if (isBase64(key)) {
      keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    } else if (key.startsWith('0x')) {
      keyBytes = Uint8Array.from(key.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      // Assume hex without 0x prefix
      keyBytes = Uint8Array.from(key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    }
    
    return keyBytes.length === 32;
  } catch {
    return false;
  }
}

/**
 * Validate Octra address format
 * - Must start with "oct"
 * - Must be valid base58
 * - Must have reasonable length (typically 34-36 chars for oct prefix + hash)
 */
export function validateAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const trimmed = address.trim();

  // Must start with "oct"
  if (!trimmed.startsWith('oct')) {
    return false;
  }

  // Length check (oct prefix + base58 encoded hash)
  if (trimmed.length < 10 || trimmed.length > 50) {
    return false;
  }

  // Try to base58 decode (without the "oct" prefix)
  try {
    const hashPart = trimmed.slice(3); // Remove "oct" prefix
    bs58.decode(hashPart);
    return true;
  } catch {
    return false;
  }
}
