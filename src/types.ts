export interface WalletData {
  priv: string; // Decrypted private key (in memory only)
  addr: string;
  rpc: string;
}

export interface EncryptedWalletData {
  addr: string;
  rpc: string;
  salt: string; // Base64 encoded
  iv: string; // Base64 encoded
  ciphertext: string; // Base64 encoded encrypted private key
}

export interface BalanceResponse {
  balance: string;
  address: string;
}

export interface TransactionRequest {
  from: string;
  to_: string;
  amount: string;
  nonce: number;  // INT (pre-client uses int)
  ou: string;
  timestamp: number;  // FLOAT (pre-client uses time.time() which is float)
  signature: string;
  public_key: string;
  message?: string;
  priority?: 'normal' | 'express';  // Transaction priority
}

export interface TransactionStatus {
  status: 'pending' | 'included' | 'finalized' | 'not_found';
  epoch?: number;
  tx_hash: string;
}

export interface TransactionResponse {
  txHash: string;
  success: boolean;
}

export interface TransactionHistory {
  hash: string;
  epoch: number;
  from: string;
  to: string;
  amount: string; // OCT amount as string
  timestamp: number; // Unix timestamp (float)
  priority: 'normal' | 'express';
  nonce: number;
}

export interface TransactionsResponse {
  total: number;
  transactions: TransactionHistory[];
}
