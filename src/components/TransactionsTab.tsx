import { useState, useEffect, useCallback, useRef } from 'react';
import type { WalletData } from '../types';
import { getTransactions, getTransactionStatus } from '../utils/rpc';
import { loadTransactions, mergeTransactions, updateTransactionStatus } from '../utils/txStorage';
import type { StoredTransaction } from '../utils/txStorage';
import { CopyButton } from './CopyButton';

interface TransactionsTabProps {
  wallet: WalletData;
}

export function TransactionsTab({ wallet }: TransactionsTabProps) {
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load from localStorage first (optimistic UI)
  useEffect(() => {
    const stored = loadTransactions(wallet.addr);
    if (stored.length > 0) {
      setTransactions(stored);
      setLoading(false);
    }
  }, [wallet.addr]);

  // Fetch from API and merge with stored transactions
  const fetchAndMergeTransactions = useCallback(async () => {
    try {
      setError('');
      const stored = loadTransactions(wallet.addr);
      
      // Fetch from API
      const data = await getTransactions(wallet.addr, 20);
      
      // Merge API results with stored pending transactions
      const merged = mergeTransactions(stored, data.transactions);
      setTransactions(merged);
      
      // Start polling for pending transactions
      startPollingPending(merged);
      
      return merged;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch transactions';
      setError(errMsg);
      // Keep existing transactions if fetch fails (never wipe UI)
      const stored = loadTransactions(wallet.addr);
      if (stored.length > 0) {
        setTransactions(stored);
        startPollingPending(stored);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [wallet.addr]);

  useEffect(() => {
    fetchAndMergeTransactions();
    
    // Poll every 15 seconds for updates
    const interval = setInterval(() => {
      fetchAndMergeTransactions();
    }, 15000);
    
    return () => {
      clearInterval(interval);
      // Clear all polling timers on unmount
      pollingRef.current.forEach(timer => clearTimeout(timer));
      pollingRef.current.clear();
    };
  }, [fetchAndMergeTransactions]);

  // Poll status for pending transactions
  const startPollingPending = useCallback((txList: StoredTransaction[]) => {
    // Clear existing timers
    pollingRef.current.forEach(timer => clearTimeout(timer));
    pollingRef.current.clear();
    
    const pendingTxs = txList.filter(tx => tx.status === 'pending');
    
    pendingTxs.forEach(tx => {
      const pollStatus = async (attempt: number = 0) => {
        if (attempt >= 30) {
          // Stop after 30 attempts (5 minutes)
          return;
        }
        
        try {
          const status = await getTransactionStatus(tx.hash);
          
          if (status.status === 'finalized' || status.status === 'included') {
            // Update transaction status
            const updated = updateTransactionStatus(
              wallet.addr,
              tx.hash,
              status.status === 'finalized' ? 'confirmed' : 'confirmed', // Treat included as confirmed
              status.epoch
            );
            setTransactions(updated);
            pollingRef.current.delete(tx.hash);
          } else if (status.status === 'pending' || status.status === 'not_found') {
            // Continue polling
            const timer = setTimeout(() => pollStatus(attempt + 1), 10000);
            pollingRef.current.set(tx.hash, timer);
          }
        } catch (err) {
          // On error, continue polling
          const timer = setTimeout(() => pollStatus(attempt + 1), 10000);
          pollingRef.current.set(tx.hash, timer);
        }
      };
      
      // Start polling after 5 seconds
      const timer = setTimeout(() => pollStatus(), 5000);
      pollingRef.current.set(tx.hash, timer);
    });
  }, [wallet.addr]);

  const formatAddress = (addr: string) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 5)}..${addr.slice(-5)}`;
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 5)}..${hash.slice(-5)}`;
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return { timeAgo: 'N/A', fullTime: 'N/A' };
    const date = new Date(timestamp * 1000);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeAgo = '';
    if (diffMins < 1) timeAgo = 'just now';
    else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
    else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
    else timeAgo = `${diffDays}d ago`;

    return {
      timeAgo,
      fullTime: date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    };
  };

  const getOctraScanUrl = (hash: string) => {
    return `https://octrascan.io/transactions/${hash}`;
  };

  const getDirection = (tx: StoredTransaction): 'sent' | 'received' => {
    return tx.from === wallet.addr ? 'sent' : 'received';
  };

  const getCounterparty = (tx: StoredTransaction) => {
    const direction = getDirection(tx);
    const addr = direction === 'sent' ? tx.to : tx.from;
    const label = direction === 'sent' ? 'To' : 'From';
    return { address: addr, label };
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="transactions-tab">
        <h2 className="section-title">Transactions</h2>
        <div className="tx-card-list">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="tx-card">
              <div className="tx-card-skeleton">
                <div className="skeleton" style={{ width: '60px', height: '24px', marginBottom: '12px' }}></div>
                <div className="skeleton" style={{ width: '120px', height: '32px', marginBottom: '16px' }}></div>
                <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '8px' }}></div>
                <div className="skeleton" style={{ width: '100%', height: '14px' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="transactions-tab">
        <h2 className="section-title">Transactions</h2>
        <div className="error">{error}</div>
        <p style={{ marginTop: '12px', color: '#666' }}>
          Unable to refresh transactions. Please try again later.
        </p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="transactions-tab">
        <h2 className="section-title">Transactions</h2>
        {error && <div className="error-small" style={{ marginBottom: '16px' }}>{error}</div>}
        <div className="tx-empty">
          <p className="tx-empty-title">No transactions yet</p>
          <p className="tx-empty-hint">Transactions will appear here once you send or receive OCT.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transactions-tab">
      <h2 className="section-title">Transactions</h2>
      {error && (
        <div className="error-small" style={{ marginBottom: '16px' }}>
          Unable to refresh: {error}
        </div>
      )}
      <div className="tx-card-list">
        {transactions.map((tx) => {
          const direction = getDirection(tx);
          const counterparty = getCounterparty(tx);
          const timeInfo = formatTime(tx.timestamp);
          const isPending = tx.status === 'pending';

          return (
            <div key={tx.hash} className="tx-card">
              {/* 1. Direction badge + Status */}
              <div className="tx-card-header">
                <span className={`tx-direction-badge ${direction}`}>
                  {direction === 'sent' ? 'Sent' : 'Received'}
                </span>
                {isPending ? (
                  <span className="tx-badge tx-badge--pending">
                    <span className="priority-dot">●</span>
                    PENDING
                  </span>
                ) : (
                  <span className={`tx-badge tx-priority-badge ${(tx.priority || 'normal').toLowerCase()}`}>
                    {(tx.priority || 'normal').toLowerCase() === 'express' && <span className="priority-dot">●</span>}
                    {(tx.priority || 'normal').charAt(0).toUpperCase() + (tx.priority || 'normal').slice(1).toLowerCase()}
                  </span>
                )}
              </div>

              {/* 2. Amount (big) */}
              <div className="tx-card-amount">
                {parseFloat(tx.amount || '0').toFixed(6)} <span className="tx-amount-unit">OCT</span>
              </div>

              {/* 3. Counterparty */}
              <div className="tx-card-counterparty">
                <span className="tx-counterparty-label">{counterparty.label}:</span>
                <span className="tx-counterparty-address">{formatAddress(counterparty.address)}</span>
                <CopyButton text={counterparty.address} className="tx-copy-btn-small" />
              </div>

              {/* 4. Time (merged) */}
              <div className="tx-card-time">
                <span className="tx-time-ago">{timeInfo.timeAgo}</span>
                <span className="tx-time-separator">·</span>
                <span className="tx-time-full" title={timeInfo.fullTime}>
                  {timeInfo.fullTime}
                </span>
              </div>

              {/* 5. Epoch + Hash + View link (merged) */}
              {tx.epoch !== undefined ? (
                <div className="tx-card-footer">
                  <div className="tx-card-meta-merged">
                    <span className="tx-epoch-label">Epoch:</span>
                    <a
                      href={`https://octrascan.io/epochs/${tx.epoch}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      {tx.epoch}
                    </a>
                    <span className="tx-meta-separator">·</span>
                    <span className="tx-hash-short">{formatHash(tx.hash)}</span>
                    <CopyButton text={tx.hash} className="tx-copy-btn-small" />
                    <a
                      href={getOctraScanUrl(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-view-link"
                    >
                      View on OctraScan →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="tx-card-footer">
                  <div className="tx-card-meta-merged">
                    <span className="tx-hash-short">{formatHash(tx.hash)}</span>
                    <CopyButton text={tx.hash} className="tx-copy-btn-small" />
                    <span className="tx-meta-separator">·</span>
                    <span className="tx-pending-note">Confirming...</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}