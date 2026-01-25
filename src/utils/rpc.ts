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

// ===== Private/Encrypted Balance Functions =====

export interface EncryptedBalanceData {
  public_balance: number;
  public_balance_raw: number;
  encrypted_balance: number;
  encrypted_balance_raw: number;
  total_balance: number;
}

/**
 * Get encrypted (private) balance for an address
 * Requires private key header for authentication
 */
export async function getEncryptedBalance(address: string, privateKey?: string): Promise<EncryptedBalanceData | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (privateKey) {
      headers['X-Private-Key'] = privateKey;
    }

    const response = await fetch(`${API_BASE_URL}/api/encrypted-balance?addr=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data || json;
  } catch (error) {
    console.error('Failed to fetch encrypted balance:', error);
    return null;
  }
}

/**
 * Get public key for an address
 * Required for private transfers
 */
export async function getPublicKey(address: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public-key?addr=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data?.public_key || json.public_key || null;
  } catch (error) {
    console.error('Failed to fetch public key:', error);
    return null;
  }
}

export interface AddressInfo {
  address: string;
  balance: string;
  nonce: number;
  has_public_key: boolean;
}

/**
 * Get detailed address info including whether they have a public key
 */
export async function getAddressInfo(address: string): Promise<AddressInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/account?addr=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data || json;
  } catch (error) {
    console.error('Failed to fetch address info:', error);
    return null;
  }
}

export interface PendingTransfer {
  id: string;
  sender: string;
  recipient: string;
  amount_encrypted: string;
  encrypted_data?: string;
  ephemeral_key?: string;
  epoch_id: number;
  timestamp: number;
}

/**
 * Get pending private transfers for an address
 */
export async function getPendingTransfers(address: string, privateKey?: string): Promise<PendingTransfer[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (privateKey) {
      headers['X-Private-Key'] = privateKey;
    }

    const response = await fetch(`${API_BASE_URL}/api/pending-transfers?addr=${encodeURIComponent(address)}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return json.data?.pending_transfers || json.pending_transfers || [];
  } catch (error) {
    console.error('Failed to fetch pending transfers:', error);
    return [];
  }
}

export interface EncryptBalanceParams {
  address: string;
  amount: number;
  privateKey: string;
  encryptedData: string;
}

/**
 * Encrypt public balance to private balance
 */
export async function encryptBalance(params: EncryptBalanceParams): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/encrypt-balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: params.address,
        amount: String(Math.floor(params.amount * 1_000_000)), // Convert to micro-OCT
        private_key: params.privateKey,
        encrypted_data: params.encryptedData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const json = await response.json();
    return { success: true, tx_hash: json.data?.tx_hash || json.tx_hash };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Decrypt private balance to public balance
 */
export async function decryptBalance(params: EncryptBalanceParams): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/decrypt-balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: params.address,
        amount: String(Math.floor(params.amount * 1_000_000)), // Convert to micro-OCT
        private_key: params.privateKey,
        encrypted_data: params.encryptedData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const json = await response.json();
    return { success: true, tx_hash: json.data?.tx_hash || json.tx_hash };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export interface PrivateTransferParams {
  from: string;
  to: string;
  amount: number;
  fromPrivateKey: string;
  toPublicKey: string;
}

/**
 * Create a private (encrypted) transfer
 */
export async function createPrivateTransfer(params: PrivateTransferParams): Promise<{ success: boolean; tx_hash?: string; ephemeral_key?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/private-transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        amount: String(Math.floor(params.amount * 1_000_000)), // Convert to micro-OCT
        from_private_key: params.fromPrivateKey,
        to_public_key: params.toPublicKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const json = await response.json();
    const data = json.data || json;
    return {
      success: true,
      tx_hash: data.tx_hash,
      ephemeral_key: data.ephemeral_key,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export interface ClaimTransferParams {
  recipientAddress: string;
  privateKey: string;
  transferId: string;
}

/**
 * Claim a pending private transfer
 */
export async function claimPrivateTransfer(params: ClaimTransferParams): Promise<{ success: boolean; amount?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/claim-transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_address: params.recipientAddress,
        private_key: params.privateKey,
        transfer_id: params.transferId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const json = await response.json();
    const data = json.data || json;
    return {
      success: true,
      amount: data.amount,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ===== Network Stats & Explorer Functions =====

export interface NetworkStats {
  total_transactions: number;
  total_volume: string;
  total_accounts: number;
  active_validators: number;
  peak_tps: number;
}

/**
 * Get network-wide statistics
 */
export async function getNetworkStats(): Promise<NetworkStats | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data || json;
  } catch (error) {
    console.error('Failed to fetch network stats:', error);
    return null;
  }
}

export interface Epoch {
  epoch: number;
  timestamp: number;
  validator: string;
  tx_count: number;
  tree_hash: string;
}

/**
 * Get list of epochs with pagination
 */
export async function getEpochs(limit: number = 20, offset: number = 0): Promise<Epoch[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/epochs?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return json.data?.epochs || json.epochs || [];
  } catch (error) {
    console.error('Failed to fetch epochs:', error);
    return [];
  }
}

export interface Validator {
  address: string;
  balance: string;
  total_txs: number;
  latest_epoch: number;
  public_key: string;
  score: number;
  uptime: number;
  nonce: number;
}

/**
 * Get list of validators with pagination
 */
export async function getValidators(limit: number = 50, offset: number = 0): Promise<Validator[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/validators?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    return json.data?.validators || json.validators || [];
  } catch (error) {
    console.error('Failed to fetch validators:', error);
    return [];
  }
}

export interface StagingPoolInfo {
  total_pending: number;
  ou_used: number;
  ou_remaining: number;
  transactions: Array<{
    from: string;
    to: string;
    amount: string;
    nonce: number;
    timestamp: number;
  }>;
}

/**
 * Get staging pool (mempool) info
 */
export async function getStagingPool(limit: number = 50): Promise<StagingPoolInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/staging-pool?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json.data || json;
  } catch (error) {
    console.error('Failed to fetch staging pool:', error);
    return null;
  }
}
