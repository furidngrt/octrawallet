import { useState, useEffect, useCallback } from 'react';
import type { WalletData } from '../types';
import { getBalance, getNonce, sendTransaction as sendTx, getTransactions } from '../utils/rpc';
import { signTransactionData, amountToMicroOCT } from '../utils/crypto';
import { getNextNonce, releaseNonce } from '../utils/nonceManager';
import { loadTransactions, mergeTransactions, upsertTransaction, saveTransactions } from '../utils/txStorage';
import type { StoredTransaction } from '../utils/txStorage';
import { SendTransaction } from './SendTransaction';
import { StatsCard } from './StatsCard';
import { RecentTransactions } from './RecentTransactions';

interface WalletViewProps {
  wallet: WalletData;
}

export function WalletView({ wallet }: WalletViewProps) {
  const [balance, setBalance] = useState<string>('0');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [txCount, setTxCount] = useState<number>(0);
  // Load recent transactions from localStorage first (optimistic UI)
  const [recentTxs, setRecentTxs] = useState<StoredTransaction[]>(() => loadTransactions(wallet.addr));
  const [txError, setTxError] = useState<string>('');

  const fetchBalance = async () => {
    setError('');
    try {
      const bal = await getBalance(wallet.addr);
      const n = await getNonce(wallet.addr);
      setBalance(bal);
      // Nonce represents transaction count
      setTxCount(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    }
  };

  // Fetch and refresh transactions
  const fetchTransactions = useCallback(async () => {
    try {
      setTxError('');
      // Load from localStorage first (preserve confirmed status)
      const stored = loadTransactions(wallet.addr);
      if (stored.length > 0) {
        setRecentTxs(stored);
      }
      
      // Fetch from API and merge (mergeTransactions will preserve confirmed status)
      const data = await getTransactions(wallet.addr, 5); // Get only 5 for recent
      const merged = mergeTransactions(stored, data.transactions);
      
      // Save merged result back to localStorage to persist confirmed status
      if (merged.length > 0) {
        saveTransactions(wallet.addr, merged);
      }
      
      setRecentTxs(merged);
    } catch (err) {
      // On error: keep existing transactions, just set error message
      setTxError('Unable to refresh transactions');
      // Do NOT clear transactions - keep what we have from localStorage (including confirmed status)
      // stored transactions with confirmed status are already in state from loadTransactions above
    }
  }, [wallet.addr]);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    // Refresh balance every 10 seconds (silent to avoid flickering)
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet.addr, fetchTransactions]);

  const handleGetNextNonce = useCallback(async (): Promise<number> => {
    return getNextNonce(wallet.addr, getNonce);
  }, [wallet.addr]);

  const handleSend = async (
    to: string,
    amount: string,
    priority: 'normal' | 'express' = 'normal',
    reservedNonce?: number
  ) => {
    setSending(true);
    setError('');
    let txNonce: number;

    try {
      // Use reserved nonce if provided, otherwise get next nonce
      if (reservedNonce !== undefined) {
        txNonce = reservedNonce;
      } else {
        // Fallback: get nonce if not reserved (shouldn't happen in normal flow)
        txNonce = await getNextNonce(wallet.addr, getNonce);
      }

      // Pre-client uses time.time() which returns float (seconds since epoch)
      const txTimestamp = Date.now() / 1000;
      
      // Sign transaction
      const { signature, publicKey } = signTransactionData(
        wallet.priv,
        wallet.addr,
        to,
        amount,
        txNonce,
        txTimestamp
      );
      
      // Build transaction object matching pre-client format
      // Amount conversion now handled in crypto.ts using BigInt
      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || !isFinite(amountFloat)) {
        throw new Error('Invalid amount');
      }
      
      // OU: Server requires minimum 1000
      const ou = amountFloat < 1000 ? "1000" : "3";
      
      // Get raw amount from crypto (converted to microOCT string using BigInt)
      const amountRaw = amountToMicroOCT(amount);
      
      const txData = {
        from: wallet.addr,
        to_: to,
        amount: amountRaw,  // String from BigInt conversion
        nonce: txNonce,  // INT (pre-client format)
        ou,
        timestamp: txTimestamp,  // FLOAT (pre-client format)
        signature,
        public_key: publicKey,
        priority: priority,
      };
      
      const txHash = await sendTx(txData);
      
      // Release nonce on success
      releaseNonce(wallet.addr, true);
      
      // Persist pending transaction to localStorage immediately (optimistic UI)
      const newTx = upsertTransaction(wallet.addr, {
        hash: txHash,
        timestamp: txTimestamp,
        from: wallet.addr,
        to,
        amount,
        priority: priority,
        nonce: txNonce,
        // epoch omitted for pending transactions
        status: 'pending',
      });
      
      // Update UI immediately (optimistic)
      setRecentTxs(newTx.slice(0, 5)); // Show only 5 most recent
      
      await fetchBalance(); // Refresh balance after send
      return txHash;
    } catch (err) {
      // Release nonce on failure
      releaseNonce(wallet.addr, false);
      
      const errMsg = err instanceof Error ? err.message : 'Failed to send transaction';
      
      // If error is nonce-related, try once more with fresh nonce
      if (errMsg.includes('nonce') && reservedNonce !== undefined) {
        try {
          // Retry with fresh nonce
          const freshNonce = await getNextNonce(wallet.addr, getNonce);
          return handleSend(to, amount, priority, freshNonce);
        } catch (retryErr) {
          setError(errMsg);
          throw retryErr;
        }
      }
      
      setError(errMsg);
      throw err;
    } finally {
      setSending(false);
    }
  };


  const formatAddress = (addr: string) => {
    // Format: oct6g..S7LZC (5 chars + .. + 5 chars)
    return `${addr.slice(0, 5)}..${addr.slice(-5)}`;
  };

  return (
    <div className="wallet-view">
      {/* Stats Row */}
      <div className="stats-row">
        <StatsCard
          label="balance"
          value={balance || '0'}
          subValue=" OCT"
        />
        <StatsCard
          label="address"
          value={formatAddress(wallet.addr)}
          copyText={wallet.addr}
        />
        <StatsCard
          label="transactions count"
          value={txCount}
        />
      </div>

      {/* Error Display */}
      {error && <div className="error">{error}</div>}

      {/* Main Section */}
      <div className="main-section">
        <div className="two-column-layout">
          {/* Left: Send Card */}
          <div className="send-card-wrapper">
            <SendTransaction
              onSend={handleSend}
              balance={balance}
              loading={sending}
              walletAddress={wallet.addr}
              getNextNonce={handleGetNextNonce}
            />
          </div>

          {/* Right: Recent Transactions */}
          <div className="recent-tx-wrapper">
            <RecentTransactions 
              transactions={recentTxs} 
              loading={false}
              error={txError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
