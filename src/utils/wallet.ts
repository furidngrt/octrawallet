import type { WalletData, EncryptedWalletData } from '../types';
import { privateKeyToAddress } from './crypto';
import { encryptPrivateKey, decryptPrivateKey } from './encryption';
export { clearNonceState as clearNonceState } from './nonceManager';

/**
 * Load wallet from JSON (compatible with pre-client format)
 * Returns decrypted WalletData if encrypted, or plain WalletData
 */
export async function loadWalletFromJSON(
  json: string,
  passphrase?: string
): Promise<WalletData> {
  try {
    const data = JSON.parse(json);
    
    // Check if it's encrypted format
    if (data.ciphertext && data.salt && data.iv) {
      if (!passphrase) {
        throw new Error('Wallet is encrypted. Passphrase required.');
      }
      const encrypted: EncryptedWalletData = data;
      const priv = await decryptPrivateKey(
        {
          salt: encrypted.salt,
          iv: encrypted.iv,
          ciphertext: encrypted.ciphertext,
        },
        passphrase
      );
      return {
        priv,
        addr: encrypted.addr,
        rpc: encrypted.rpc,
      };
    }
    
    // Legacy unencrypted format
    if (!data.priv || !data.addr) {
      throw new Error('Invalid wallet format: missing priv or addr');
    }
    return data as WalletData;
  } catch (error) {
    throw new Error(`Failed to parse wallet JSON: ${error}`);
  }
}

/**
 * Create wallet data from private key
 */
export async function createWalletFromPrivateKey(
  privateKey: string,
  rpc: string = 'https://octra.network'
): Promise<WalletData> {
  const addr = await privateKeyToAddress(privateKey);
  return {
    priv: privateKey,
    addr,
    rpc,
  };
}

/**
 * Encrypt and save wallet to localStorage
 */
export async function saveEncryptedWallet(
  wallet: WalletData,
  passphrase: string
): Promise<void> {
  const encrypted = await encryptPrivateKey(wallet.priv, passphrase);
  const encryptedWallet: EncryptedWalletData = {
    addr: wallet.addr,
    rpc: wallet.rpc,
    salt: encrypted.salt,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
  localStorage.setItem('octra_wallet', JSON.stringify(encryptedWallet));
}

/**
 * Check if stored wallet is encrypted
 */
export function isWalletEncrypted(): boolean {
  try {
    const stored = localStorage.getItem('octra_wallet');
    if (!stored) return false;
    const data = JSON.parse(stored);
    return !!(data.ciphertext && data.salt && data.iv);
  } catch {
    return false;
  }
}

/**
 * Load encrypted wallet from localStorage
 */
export async function loadEncryptedWallet(
  passphrase: string
): Promise<WalletData | null> {
  try {
    const stored = localStorage.getItem('octra_wallet');
    if (!stored) return null;
    return await loadWalletFromJSON(stored, passphrase);
  } catch {
    return null;
  }
}

/**
 * Clear wallet from localStorage
 */
export function clearWallet(): void {
  localStorage.removeItem('octra_wallet');
}

/**
 * Clear ALL wallet data (full logout)
 * Removes encrypted wallet, all transaction history, and session data
 */
export function clearAllWalletData(): void {
  // Clear encrypted wallet
  localStorage.removeItem('octra_wallet');
  
  // Clear all transaction history (for all addresses)
  // Find all keys that start with 'octra_tx_'
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('octra_tx_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear session storage
  sessionStorage.removeItem('octra_wallet_session');
  
  // Clear all decrypted wallet caches from sessionStorage
  const sessionKeysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('octra_wallet_decrypted_')) {
      sessionKeysToRemove.push(key);
    }
  }
  sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Export wallet to JSON (compatible with pre-client format)
 * WARNING: This exports unencrypted private key. Only use for backup.
 */
export function exportWalletToJSON(wallet: WalletData): string {
  return JSON.stringify(wallet, null, 2);
}

/**
 * Session management for wallet unlock state
 * Uses sessionStorage (cleared when tab closes)
 */

const SESSION_KEY = 'octra_wallet_session';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour default

interface WalletSession {
  unlocked: true;
  expiry: number; // Unix timestamp (ms)
  address: string; // Wallet address for verification
}

/**
 * Check if wallet session is still valid
 */
export function isSessionValid(): boolean {
  try {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return false;
    
    const session: WalletSession = JSON.parse(sessionStr);
    
    // Check expiry
    if (Date.now() > session.expiry) {
      // Session expired, clear it
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    
    // Verify wallet still exists and matches
    const encrypted = isWalletEncrypted();
    if (!encrypted) {
      // Wallet removed, clear session
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get wallet address from session (if valid)
 */
export function getSessionAddress(): string | null {
  try {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;
    
    const session: WalletSession = JSON.parse(sessionStr);
    if (Date.now() > session.expiry) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    return session.address;
  } catch {
    return null;
  }
}

/**
 * Create wallet unlock session
 * Stores unlock state in sessionStorage (cleared when tab closes)
 */
export function createUnlockSession(walletAddress: string, durationMs: number = SESSION_DURATION_MS): void {
  const session: WalletSession = {
    unlocked: true,
    expiry: Date.now() + durationMs,
    address: walletAddress,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Clear unlock session
 */
export function clearUnlockSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Try to auto-unlock wallet if session is valid
 * Returns decrypted wallet if session valid, null otherwise
 * 
 * Note: Decrypted wallet is stored in sessionStorage (tab-specific, cleared on tab close)
 * This is a pragmatic solution for web apps where true RAM-only storage isn't possible across page refreshes
 */
export function tryAutoUnlock(): WalletData | null {
  // Check if session is valid
  if (!isSessionValid()) {
    return null;
  }
  
  try {
    const sessionStr = sessionStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;
    
    const session: WalletSession = JSON.parse(sessionStr);
    if (Date.now() > session.expiry) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    // Check if decrypted wallet is cached in sessionStorage
    const decryptedKey = `octra_wallet_decrypted_${session.address}`;
    const decryptedStr = sessionStorage.getItem(decryptedKey);
    
    if (decryptedStr) {
      try {
        const wallet: WalletData = JSON.parse(decryptedStr);
        // Verify address matches
        if (wallet.addr === session.address) {
          return wallet;
        }
      } catch {
        // Invalid cached data, clear it
        sessionStorage.removeItem(decryptedKey);
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache decrypted wallet in sessionStorage (tab-specific, cleared on close)
 */
export function cacheDecryptedWallet(wallet: WalletData): void {
  const decryptedKey = `octra_wallet_decrypted_${wallet.addr}`;
  sessionStorage.setItem(decryptedKey, JSON.stringify(wallet));
}

/**
 * Clear cached decrypted wallet from sessionStorage
 */
export function clearDecryptedWalletCache(address: string): void {
  const decryptedKey = `octra_wallet_decrypted_${address}`;
  sessionStorage.removeItem(decryptedKey);
}

