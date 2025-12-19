/**
 * Backend input validation utilities
 */

/**
 * Validate Octra address format
 */
export function validateAddress(address: any): boolean {
  if (typeof address !== 'string' || !address) {
    return false;
  }

  const trimmed = address.trim();

  // Must start with "oct"
  if (!trimmed.startsWith('oct')) {
    return false;
  }

  // Length check
  if (trimmed.length < 10 || trimmed.length > 50) {
    return false;
  }

  // Basic format validation (base58 check would require bs58 lib)
  // For backend, we do basic checks; RPC will validate more strictly
  const hashPart = trimmed.slice(3);
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(hashPart)) {
    return false; // Not valid base58 characters
  }

  return true;
}

/**
 * Validate transaction data structure and types
 */
export function validateTransactionData(txData: any): { valid: boolean; error?: string } {
  // Check required fields
  if (!txData.from || typeof txData.from !== 'string') {
    return { valid: false, error: 'Missing or invalid "from" address' };
  }

  if (!txData.to_ || typeof txData.to_ !== 'string') {
    return { valid: false, error: 'Missing or invalid "to_" address' };
  }

  if (!txData.amount || typeof txData.amount !== 'string') {
    return { valid: false, error: 'Missing or invalid "amount" (must be string)' };
  }

  if (typeof txData.nonce !== 'number' || !Number.isInteger(txData.nonce) || txData.nonce < 0) {
    return { valid: false, error: 'Missing or invalid "nonce" (must be non-negative integer)' };
  }

  if (typeof txData.timestamp !== 'number' || !isFinite(txData.timestamp)) {
    return { valid: false, error: 'Missing or invalid "timestamp" (must be number)' };
  }

  if (!txData.signature || typeof txData.signature !== 'string') {
    return { valid: false, error: 'Missing or invalid "signature" (must be string)' };
  }

  if (!txData.public_key || typeof txData.public_key !== 'string') {
    return { valid: false, error: 'Missing or invalid "public_key" (must be string)' };
  }

  if (!txData.ou || typeof txData.ou !== 'string') {
    return { valid: false, error: 'Missing or invalid "ou" (must be string)' };
  }

  // Validate addresses
  if (!validateAddress(txData.from)) {
    return { valid: false, error: 'Invalid "from" address format' };
  }

  if (!validateAddress(txData.to_)) {
    return { valid: false, error: 'Invalid "to_" address format' };
  }

  // Validate amount (must be numeric string representing microOCT)
  const amountStr = txData.amount.toString();
  if (!/^\d+$/.test(amountStr)) {
    return { valid: false, error: 'Invalid "amount" format (must be numeric string)' };
  }

  // Check amount is reasonable (not zero, not too large)
  try {
    // Use string comparison to avoid BigInt issues in some environments
    if (amountStr === '0') {
      return { valid: false, error: 'Amount cannot be zero' };
    }
    // Check if it's a valid number string
    if (!/^\d+$/.test(amountStr)) {
      return { valid: false, error: 'Invalid amount format (must be numeric string)' };
    }
    // Basic length check: max 24 digits (very large number)
    if (amountStr.length > 24) {
      return { valid: false, error: 'Amount exceeds maximum limit' };
    }
  } catch {
    return { valid: false, error: 'Invalid amount value' };
  }

  // Validate timestamp (should be reasonable Unix timestamp)
  const now = Date.now() / 1000;
  const txTime = txData.timestamp;
  // Allow timestamps within 5 minutes of now (for clock skew)
  if (txTime < now - 300 || txTime > now + 300) {
    return { valid: false, error: 'Invalid timestamp (too far from current time)' };
  }

  // Validate signature and public_key format (should be base64)
  if (txData.signature.length > 200) {
    return { valid: false, error: 'Signature too long' };
  }

  if (txData.public_key.length > 200) {
    return { valid: false, error: 'Public key too long' };
  }

  // Validate OU
  if (txData.ou !== '1000' && txData.ou !== '3') {
    return { valid: false, error: 'Invalid "ou" value (must be "1000" or "3")' };
  }

  // Validate priority if present
  if (txData.priority !== undefined && txData.priority !== 'normal' && txData.priority !== 'express') {
    return { valid: false, error: 'Invalid priority (must be "normal" or "express")' };
  }

  return { valid: true };
}

/**
 * Validate JSON payload size
 */
export function validatePayloadSize(payload: string, maxSize: number = 10000): { valid: boolean; error?: string } {
  if (payload.length > maxSize) {
    return { valid: false, error: `Payload too large (max ${maxSize} bytes)` };
  }
  return { valid: true };
}

