import { useState, useEffect, useCallback } from 'react';
import type { WalletData } from '../types';
import { getBalance, getNonce, sendTransaction as sendTx, getTransactions } from '../utils/rpc';
import { signTransactionData, amountToMicroOCT } from '../utils/crypto';
import { getNextNonce, releaseNonce } from '../utils/nonceManager';
import { loadTransactions, mergeTransactions, upsertTransaction, saveTransactions } from '../utils/txStorage';
import type { StoredTransaction } from '../utils/txStorage';
import { SendTransaction } from './SendTransaction';
import { RecentTransactions } from './RecentTransactions';
import { PrivateBalance } from './PrivateBalance';

interface WalletViewProps {
  wallet: WalletData;
}

export function WalletView({ wallet }: WalletViewProps) {
  const [balance, setBalance] = useState<string>('0');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [txCount, setTxCount] = useState<number>(0);
  const [recentTxs, setRecentTxs] = useState<StoredTransaction[]>(() => loadTransactions(wallet.addr));
  const [txError, setTxError] = useState<string>('');

  const fetchBalance = async () => {
    setError('');
    try {
      const bal = await getBalance(wallet.addr);
      const n = await getNonce(wallet.addr);
      setBalance(bal);
      setTxCount(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    }
  };

  const fetchTransactions = useCallback(async () => {
    try {
      setTxError('');
      const stored = loadTransactions(wallet.addr);
      if (stored.length > 0) {
        setRecentTxs(stored);
      }

      const data = await getTransactions(wallet.addr, 5);
      const merged = mergeTransactions(stored, data.transactions);

      if (merged.length > 0) {
        saveTransactions(wallet.addr, merged);
      }

      setRecentTxs(merged);
    } catch (err) {
      setTxError('Unable to refresh transactions');
    }
  }, [wallet.addr]);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
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
      if (reservedNonce !== undefined) {
        txNonce = reservedNonce;
      } else {
        txNonce = await getNextNonce(wallet.addr, getNonce);
      }

      const txTimestamp = Date.now() / 1000;

      const { signature, publicKey } = signTransactionData(
        wallet.priv,
        wallet.addr,
        to,
        amount,
        txNonce,
        txTimestamp
      );

      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || !isFinite(amountFloat)) {
        throw new Error('Invalid amount');
      }

      const ou = amountFloat < 1000 ? "1000" : "3";
      const amountRaw = amountToMicroOCT(amount);

      const txData = {
        from: wallet.addr,
        to_: to,
        amount: amountRaw,
        nonce: txNonce,
        ou,
        timestamp: txTimestamp,
        signature,
        public_key: publicKey,
        priority: priority,
      };

      const txHash = await sendTx(txData);
      releaseNonce(wallet.addr, true);

      const newTx = upsertTransaction(wallet.addr, {
        hash: txHash,
        timestamp: txTimestamp,
        from: wallet.addr,
        to,
        amount,
        priority: priority,
        nonce: txNonce,
        status: 'pending',
      });

      setRecentTxs(newTx.slice(0, 5));
      await fetchBalance();
      return txHash;
    } catch (err) {
      releaseNonce(wallet.addr, false);

      const errMsg = err instanceof Error ? err.message : 'Failed to send transaction';

      if (errMsg.includes('nonce') && reservedNonce !== undefined) {
        try {
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

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.addr);
  };

  // Format balance for display
  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  return (
    <div className="wallet-dashboard">
      {/* Header Stats Bar */}
      <div className="dashboard-stats">
        <div className="stat-item">
          <span className="stat-label">Balance</span>
          <span className="stat-value">
            <span className="oct-icon">◎</span>
            {formatBalance(balance)} OCT
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Transactions</span>
          <span className="stat-value">{txCount}</span>
        </div>
        <div className="stat-item address-stat">
          <span className="stat-label">Address</span>
          <div className="address-display">
            <span className="address-text">{wallet.addr.slice(0, 8)}...{wallet.addr.slice(-6)}</span>
            <button onClick={copyAddress} className="copy-btn" title="Copy address">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Private Balance Section - Above other sections */}
      <div className="card-panel">
        <PrivateBalance
          walletAddress={wallet.addr}
          privateKey={wallet.priv}
          onRefresh={fetchBalance}
        />
      </div>

      {/* Main Grid Layout - Responsive */}
      <div className="dashboard-grid">
        {/* Send Transaction Panel */}
        <div className="card-panel">
          <div className="card-panel-header">
            <h3>Send Transaction</h3>
          </div>
          <div className="card-panel-body">
            <SendTransaction
              onSend={handleSend}
              balance={balance}
              loading={sending}
              walletAddress={wallet.addr}
              getNextNonce={handleGetNextNonce}
            />
          </div>
        </div>

        {/* Recent Transactions Panel */}
        <div className="card-panel">
          <div className="card-panel-header">
            <h3>Recent Transactions</h3>
          </div>
          <div className="card-panel-body" style={{ padding: 0 }}>
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
