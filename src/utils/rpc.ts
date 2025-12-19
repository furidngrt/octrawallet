import { OCTRA_RPC_URL } from '../config';
import type { TransactionRequest, TransactionsResponse } from '../types';

// Use backend API base URL from env var, fallback to localhost for dev
// VITE_API_BASE_URL should be without trailing slash and without /api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Get balance for an address
 * Uses backend proxy if available, otherwise direct RPC call
 */
export async function getBalance(address: string): Promise<string> {
  try {
    // Try backend proxy first
    const proxyUrl = `${API_BASE_URL}/api/balance?addr=${encodeURIComponent(address)}`;
    const directUrl = `${OCTRA_RPC_URL}/balance/${address}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(() => {
      // Fallback to direct RPC if proxy fails
      return fetch(directUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Ensure we return the balance as a string, formatted correctly
    const balance = data.balance || '0';
    // Convert to number and back to string to normalize formatting
    const balanceNum = parseFloat(balance);
    return isNaN(balanceNum) ? '0' : balanceNum.toString();
  } catch (error) {
    throw new Error(`Failed to fetch balance: ${error}`);
  }
}

/**
 * Get nonce for an address
 * Uses backend proxy if available, otherwise direct RPC call
 */
export async function getNonce(address: string): Promise<number> {
  try {
    // Try backend proxy first
    const proxyUrl = `${API_BASE_URL}/api/balance?addr=${encodeURIComponent(address)}`;
    const directUrl = `${OCTRA_RPC_URL}/balance/${address}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(() => {
      // Fallback to direct RPC if proxy fails
      return fetch(directUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.nonce || 0;
  } catch (error) {
    throw new Error(`Failed to fetch nonce: ${error}`);
  }
}

/**
 * Get transaction status by hash
 * Returns: pending | included (epoch) | finalized | not_found
 */
export async function getTransactionStatus(txHash: string): Promise<{ status: 'pending' | 'included' | 'finalized' | 'not_found'; epoch?: number }> {
  try {
    const proxyUrl = `${API_BASE_URL}/api/tx/${txHash}`;
    const directUrl = `${OCTRA_RPC_URL}/tx/${txHash}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      return fetch(directUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'not_found' };
      }
      return { status: 'pending' }; // If error, assume pending
    }

    const data = await response.json();
    
    // Response has: status: "confirmed" (finalized), epoch number
    if (data.status === 'confirmed' && data.epoch !== undefined) {
      return { status: 'finalized', epoch: data.epoch };
    }
    if (data.status && data.epoch !== undefined) {
      return { status: 'included', epoch: data.epoch };
    }
    
    return { status: 'pending' };
  } catch (error) {
    return { status: 'pending' }; // On error, assume pending
  }
}

/**
 * Send transaction
 * Uses backend proxy if available, otherwise direct RPC call
 */
export async function sendTransaction(
  txData: TransactionRequest
): Promise<string> {
  try {
    // Try backend proxy first
    // API_BASE_URL should be without trailing slash and without /api
    // So we construct: ${API_BASE_URL}/api/send-tx
    const proxyUrl = `${API_BASE_URL}/api/send-tx`;
    const directUrl = `${OCTRA_RPC_URL}/send-tx`;
    
    // Debug: Log URL in development
    if (import.meta.env.DEV) {
      console.log('Sending transaction to:', proxyUrl);
    }
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(txData),
    }).catch((fetchErr) => {
      // Fallback to direct RPC if proxy fails
      console.error('Proxy fetch failed, trying direct RPC:', fetchErr);
      return fetch(directUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(txData),
      });
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RPC error: ${response.status} ${errorText}`);
    }

    const responseText = await response.text();
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(responseText);
      if (data.status === 'accepted' && data.tx_hash) {
        return data.tx_hash;
      }
      if (data.tx_hash) {
        return data.tx_hash;
      }
      throw new Error(`Unexpected response format: ${JSON.stringify(data)}`);
    } catch {
      // Not JSON, might be plain text "ok <hash>"
      if (responseText.toLowerCase().startsWith('ok')) {
        const parts = responseText.trim().split(/\s+/);
        return parts[parts.length - 1];
      }
      throw new Error(`Unexpected response format: ${responseText}`);
    }
  } catch (error) {
    throw new Error(`Failed to send transaction: ${error}`);
  }
}

/**
 * Get transaction history for an address
 * Uses backend proxy if available, otherwise direct RPC call
 */
export async function getTransactions(address: string, limit: number = 10): Promise<TransactionsResponse> {
  try {
    // Try backend proxy first
    const proxyUrl = `${API_BASE_URL}/api/txs?addr=${encodeURIComponent(address)}&limit=${limit}`;
    const directUrl = `${OCTRA_RPC_URL}/txs?addr=${encodeURIComponent(address)}&limit=${limit}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(() => {
      // Fallback to direct RPC if proxy fails
      return fetch(directUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RPC error: ${response.status} ${errorText}`);
    }

    const data: TransactionsResponse = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch transactions: ${error}`);
  }
}
