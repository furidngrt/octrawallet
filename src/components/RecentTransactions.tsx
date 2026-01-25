import { useState } from 'react';
import type { StoredTransaction } from '../utils/txStorage';

interface RecentTransactionsProps {
  transactions: StoredTransaction[];
  loading?: boolean;
  error?: string;
}

export function RecentTransactions({ transactions, loading = false, error }: RecentTransactionsProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const formatAddress = (addr: string) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (timestamp: number | string) => {
    try {
      const date = typeof timestamp === 'number'
        ? new Date(timestamp * 1000)
        : new Date(timestamp);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const formatAmount = (amount: string, isIncoming: boolean) => {
    const num = parseFloat(amount.replace(' OCT', ''));
    if (isNaN(num)) return amount;
    const prefix = isIncoming ? '+' : '-';
    return `${prefix}${num.toFixed(4)} OCT`;
  };

  const getStatus = (tx: StoredTransaction): 'success' | 'pending' | 'failed' => {
    if (tx.status === 'confirmed') return 'success';
    if (tx.status === 'failed') return 'failed';
    return 'pending';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getOctraScanUrl = (hash: string) => {
    return `https://octrascan.io/transactions/${hash}`;
  };

  if (loading) {
    return (
      <div className="tx-loading">
        <div className="empty-state">
          <div className="animate-spin" style={{ fontSize: '24px' }}>⏳</div>
          <p className="empty-state-text">Loading transactions...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <h4 className="empty-state-title">No transactions yet</h4>
        <p className="empty-state-text">
          Your transaction history will appear here once you send or receive OCT.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="alert alert-warning" style={{ margin: 'var(--spacing-3)' }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Desktop Table View */}
      <table className="tx-table tx-table-responsive">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Address</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const status = getStatus(tx);
            const isIncoming = tx.to === tx.from; // Simplified - would need wallet address

            return (
              <tr key={tx.hash}>
                <td>
                  <span className={`badge ${isIncoming ? 'badge-success' : 'badge-primary'}`}>
                    {isIncoming ? '↓ IN' : '↑ OUT'}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: isIncoming ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                    {formatAmount(tx.amount, isIncoming)}
                  </span>
                </td>
                <td>
                  <div className="address-display">
                    <span className="address-text">{formatAddress(tx.to)}</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(tx.to)}
                      title="Copy address"
                    >
                      {copiedHash === tx.to ? '✓' : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${status === 'success' ? 'success' : status === 'pending' ? 'warning' : 'error'}`}>
                    {status === 'success' ? 'Confirmed' : status === 'pending' ? 'Pending' : 'Failed'}
                  </span>
                </td>
                <td>
                  <a
                    href={getOctraScanUrl(tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary"
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  >
                    {formatDate(tx.timestamp)}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile Card View */}
      <div className="tx-cards">
        {transactions.map((tx) => {
          const status = getStatus(tx);
          const isIncoming = tx.to === tx.from;

          return (
            <div key={tx.hash} className="tx-card">
              <div className="tx-card-row">
                <span className={`badge ${isIncoming ? 'badge-success' : 'badge-primary'}`}>
                  {isIncoming ? '↓ Received' : '↑ Sent'}
                </span>
                <span className={`badge badge-${status === 'success' ? 'success' : status === 'pending' ? 'warning' : 'error'}`}>
                  {status === 'success' ? 'Confirmed' : status === 'pending' ? 'Pending' : 'Failed'}
                </span>
              </div>
              <div className="tx-card-row">
                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Amount</span>
                <span style={{ fontWeight: 600, color: isIncoming ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                  {formatAmount(tx.amount, isIncoming)}
                </span>
              </div>
              <div className="tx-card-row">
                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>To</span>
                <div className="address-display">
                  <span className="address-text">{formatAddress(tx.to)}</span>
                  <button className="copy-btn" onClick={() => copyToClipboard(tx.to)}>
                    {copiedHash === tx.to ? '✓' : '📋'}
                  </button>
                </div>
              </div>
              <div className="tx-card-row">
                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Time</span>
                <a
                  href={getOctraScanUrl(tx.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                >
                  {formatDate(tx.timestamp)} →
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
