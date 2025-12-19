import type { StoredTransaction } from '../utils/txStorage';

interface RecentTransactionsProps {
  transactions: StoredTransaction[];
  loading?: boolean;
  error?: string;
}

export function RecentTransactions({ transactions, loading = false, error }: RecentTransactionsProps) {
  const formatAddress = (addr: string) => {
    if (!addr) return 'N/A';
    return `${addr.slice(0, 5)}..${addr.slice(-5)}`;
  };

  const formatDate = (timestamp: number | string) => {
    try {
      // Handle both number (Unix timestamp) and string (ISO date)
      const date = typeof timestamp === 'number' 
        ? new Date(timestamp * 1000) 
        : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : String(timestamp);
    }
  };
  
  const formatAmount = (amount: string) => {
    // If amount is already formatted with "OCT", return as is
    if (amount.includes('OCT')) return amount;
    // Otherwise, assume it's a number and format it
    const num = parseFloat(amount);
    return isNaN(num) ? amount : `${num.toFixed(6)} OCT`;
  };
  
  const getStatus = (tx: StoredTransaction): 'success' | 'pending' | 'failed' => {
    if (tx.status === 'confirmed') return 'success';
    if (tx.status === 'failed') return 'failed';
    return 'pending';
  };

  const getOctraScanUrl = (hash: string) => {
    return `https://octrascan.io/transactions/${hash}`;
  };

  if (loading) {
    return (
      <div className="tx-list-card">
        <h3 className="section-title">Recent Transactions</h3>
        <div className="tx-list-loading">
          <div className="skeleton">Loading transactions...</div>
        </div>
      </div>
    );
  }

  // ALWAYS render the container - never return null
  return (
    <div className="tx-list-card">
      <h3 className="section-title">Recent Transactions</h3>
      {error && (
        <div className="error-small" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}
      {transactions.length === 0 ? (
        <div className="tx-empty">
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="tx-list">
          {transactions.map((tx) => {
            const status = getStatus(tx);
            return (
              <div key={tx.hash} className="tx-item">
                <div className="tx-header">
                  <a
                    href={getOctraScanUrl(tx.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-hash-link"
                  >
                    {formatAddress(tx.hash)}
                  </a>
                  <span className={`tx-badge tx-badge--${status === 'success' ? 'finalized' : status === 'pending' ? 'pending' : 'failed'}`}>
                    {status === 'success' ? 'FINALIZED' : status === 'pending' && tx.epoch ? `INCLUDED (EPOCH ${tx.epoch})` : status.toUpperCase()}
                  </span>
                </div>
                <div className="tx-details">
                  <div className="tx-row amount-row">
                    <span className="tx-label">Amount</span>
                    <span className="tx-value">{formatAmount(tx.amount)}</span>
                  </div>
                  <div className="tx-meta-row">
                    <span>{formatDate(tx.timestamp)}</span>
                    {status === 'success' && tx.epoch !== undefined && (
                      <>
                        <span>·</span>
                        <span>Epoch {tx.epoch}</span>
                      </>
                    )}
                  </div>
                </div>
                {(status === 'success' || (status === 'pending' && tx.epoch !== undefined)) && (
                  <div className="tx-actions">
                    <a
                      href={getOctraScanUrl(tx.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View on OctraScan →
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

