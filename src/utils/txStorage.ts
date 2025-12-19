/**
 * Transaction storage utilities
 * Handles localStorage persistence with merge logic (never overwrites with empty array)
 */

import type { TransactionHistory } from '../types';

export interface StoredTransaction extends Omit<TransactionHistory, 'epoch'> {
  epoch?: number; // Optional for pending transactions
  status?: 'pending' | 'confirmed' | 'failed';
  createdAt?: number; // Unix timestamp when tx was created/sent
  lastCheckedAt?: number; // Unix timestamp when status was last checked
}

const STORAGE_PREFIX = 'octra_tx_';

/**
 * Get storage key for wallet address
 */
function getStorageKey(address: string): string {
  return `${STORAGE_PREFIX}${address}`;
}

/**
 * Load transactions from localStorage for a wallet address
 */
export function loadTransactions(address: string): StoredTransaction[] {
  try {
    const stored = localStorage.getItem(getStorageKey(address));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load transactions from localStorage:', err);
    return [];
  }
}

/**
 * Save transactions to localStorage (merges with existing, never overwrites with empty)
 */
export function saveTransactions(address: string, transactions: StoredTransaction[]): void {
  try {
    // Never save empty array if we're trying to clear - keep existing data
    if (transactions.length === 0) {
      const existing = loadTransactions(address);
      if (existing.length > 0) {
        // Keep existing transactions, don't overwrite with empty
        return;
      }
    }
    localStorage.setItem(getStorageKey(address), JSON.stringify(transactions));
  } catch (err) {
    console.error('Failed to save transactions to localStorage:', err);
  }
}

/**
 * Add or update a transaction in localStorage
 * Merges with existing transactions, updates if hash exists, appends if new
 */
export function upsertTransaction(address: string, tx: StoredTransaction): StoredTransaction[] {
  const existing = loadTransactions(address);
  
  // Normalize priority helper
  const normalizePriority = (priority?: string): 'normal' | 'express' => {
    if (!priority) return 'normal';
    const normalized = priority.toLowerCase();
    return normalized === 'express' ? 'express' : 'normal';
  };
  
  // Normalize priority in incoming tx
  const normalizedTx: StoredTransaction = {
    ...tx,
    priority: normalizePriority(tx.priority),
  };
  
  // Check if transaction already exists
  const index = existing.findIndex(t => t.hash === normalizedTx.hash);
  
  if (index >= 0) {
    // Update existing transaction (merge properties, preserve priority from new tx if provided)
    existing[index] = {
      ...existing[index],
      ...normalizedTx,
      // Preserve priority if new tx has it, otherwise keep existing
      priority: normalizedTx.priority || normalizePriority(existing[index].priority),
      createdAt: existing[index].createdAt || normalizedTx.createdAt || Date.now() / 1000,
      lastCheckedAt: Date.now() / 1000,
    };
  } else {
    // Add new transaction at the beginning
    const newTx: StoredTransaction = {
      ...normalizedTx,
      priority: normalizedTx.priority || 'normal',
      createdAt: normalizedTx.createdAt || Date.now() / 1000,
      lastCheckedAt: Date.now() / 1000,
    };
    existing.unshift(newTx);
  }
  
  // Sort by timestamp descending (newest first), limit to 50 transactions
  const sorted = existing.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50);
  
  saveTransactions(address, sorted);
  return sorted;
}

/**
 * Update transaction status by hash
 */
export function updateTransactionStatus(
  address: string,
  txHash: string,
  status: 'pending' | 'confirmed' | 'failed',
  epoch?: number
): StoredTransaction[] {
  const existing = loadTransactions(address);
  const updated = existing.map(tx => {
    if (tx.hash === txHash) {
      return {
        ...tx,
        status,
        epoch: epoch !== undefined ? epoch : tx.epoch,
        // Preserve priority when updating status
        priority: tx.priority || 'normal',
        lastCheckedAt: Date.now() / 1000,
      };
    }
    return tx;
  });
  
  saveTransactions(address, updated);
  return updated;
}

/**
 * Merge API transactions with stored transactions
 * API transactions take precedence (they're from the network)
 * Stored pending transactions are kept if not found in API results
 * CRITICAL: Never downgrade confirmed transactions to pending
 */
export function mergeTransactions(
  stored: StoredTransaction[],
  apiTransactions: TransactionHistory[]
): StoredTransaction[] {
  // Normalize priority helper
  const normalizePriority = (priority?: string): 'normal' | 'express' => {
    if (!priority) return 'normal';
    const normalized = priority.toLowerCase();
    return normalized === 'express' ? 'express' : 'normal';
  };

  // Convert API transactions to StoredTransaction format
  const apiTxMap = new Map<string, StoredTransaction>();
  apiTransactions.forEach(tx => {
    // Preserve priority from API, normalize to lowercase
    apiTxMap.set(tx.hash, {
      ...tx,
      priority: normalizePriority(tx.priority),
      status: 'confirmed' as const,
      lastCheckedAt: Date.now() / 1000,
    });
  });
  
  // Create a map of stored transactions for efficient lookup
  const storedTxMap = new Map<string, StoredTransaction>();
  stored.forEach(tx => {
    storedTxMap.set(tx.hash, tx);
  });
  
  // Merge logic: preserve confirmed status, update with API data
  const mergedMap = new Map<string, StoredTransaction>();
  
  // First, add all API transactions (they're confirmed from network)
  apiTxMap.forEach((apiTx, hash) => {
    const storedTx = storedTxMap.get(hash);
    mergedMap.set(hash, {
      ...apiTx,
      // Preserve priority from stored if API doesn't have it
      priority: apiTx.priority || (storedTx ? normalizePriority(storedTx.priority) : 'normal'),
      // Preserve createdAt from stored if exists
      createdAt: storedTx?.createdAt || apiTx.timestamp,
      status: 'confirmed' as const, // Always confirmed if in API response
    });
  });
  
  // Then, add stored transactions that aren't in API results
  stored.forEach(storedTx => {
    // If already in merged (from API), skip
    if (mergedMap.has(storedTx.hash)) {
      return;
    }
    
    // CRITICAL: If transaction was already confirmed, keep it as confirmed
    // Don't downgrade to pending just because API doesn't return it
    if (storedTx.status === 'confirmed') {
      mergedMap.set(storedTx.hash, {
        ...storedTx,
        // Update lastCheckedAt to show we still see it as confirmed
        lastCheckedAt: Date.now() / 1000,
      });
    } else if (storedTx.status === 'pending') {
      // Only add pending transactions (they might be too new for API)
      mergedMap.set(storedTx.hash, storedTx);
    }
    // Failed transactions are kept as-is
    else if (storedTx.status === 'failed') {
      mergedMap.set(storedTx.hash, storedTx);
    }
  });
  
  // Convert map to array, sort by timestamp descending, limit to 50
  const merged = Array.from(mergedMap.values());
  return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50);
}
