import { useState } from 'react';
import { validateAddress } from '../utils/crypto';
import { SendConfirmationModal } from './SendConfirmationModal';

interface SendTransactionProps {
  onSend: (to: string, amount: string, priority?: 'normal' | 'express', nonce?: number) => Promise<string>;
  balance: string;
  loading?: boolean;
  walletAddress?: string;
  getNextNonce?: () => Promise<number>;
}

export function SendTransaction({
  onSend,
  balance,
  loading = false,
  walletAddress,
  getNextNonce,
}: SendTransactionProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [priority, setPriority] = useState<'normal' | 'express'>('normal');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingNonce, setPendingNonce] = useState<number | null>(null);

  const handleAddressChange = (value: string) => {
    setTo(value);
    setAddressError('');

    if (!value.trim()) {
      return;
    }

    // Validate address format
    if (!validateAddress(value.trim())) {
      setAddressError('Invalid address format. Must start with "oct" and be valid base58.');
      return;
    }

    // Check if sending to self
    if (walletAddress && value.trim() === walletAddress) {
      setAddressError('Cannot send to your own address');
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTxHash('');
    setAddressError('');

    const toAddr = to.trim();
    const amountValue = amount.trim();

    if (!toAddr) {
      setError('Please enter recipient address');
      return;
    }

    if (!validateAddress(toAddr)) {
      setAddressError('Invalid address format');
      return;
    }

    if (walletAddress && toAddr === walletAddress) {
      setAddressError('Cannot send to your own address');
      return;
    }

    if (!amountValue) {
      setError('Please enter an amount');
      return;
    }

    // Validate amount (will be validated more strictly in crypto.ts)
    let amountNum: number;
    try {
      amountNum = parseFloat(amountValue);
      if (isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0) {
        setError('Please enter a valid amount');
        return;
      }
    } catch {
      setError('Invalid amount format');
      return;
    }

    const balanceNum = parseFloat(balance);
    if (amountNum > balanceNum) {
      setError('Insufficient balance');
      return;
    }

    // Reserve nonce before showing confirmation
    if (getNextNonce) {
      try {
        const nonce = await getNextNonce();
        setPendingNonce(nonce);
        setShowConfirm(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reserve transaction nonce');
      }
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setSending(true);
    try {
      const hash = await onSend(to.trim(), amount.trim(), priority, pendingNonce || undefined);
      setTxHash(hash);
      setTo('');
      setAmount('');
      setPriority('normal');
      setPendingNonce(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send transaction');
      setPendingNonce(null);
    } finally {
      setSending(false);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setPendingNonce(null);
    // Note: Nonce will be released by parent on error
  };

  return (
    <>
      {showConfirm && pendingNonce !== null && (
        <SendConfirmationModal
          to={to.trim()}
          amount={amount.trim()}
          nonce={pendingNonce}
          priority={priority}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">To Address</label>
          <input
            type="text"
            value={to}
            onChange={(e) => handleAddressChange(e.target.value)}
            placeholder="oct..."
            className="form-input mono"
            disabled={loading || sending}
          />
          {addressError && (
            <div className="form-error">{addressError}</div>
          )}
          {to.trim() && !addressError && validateAddress(to.trim()) && (!walletAddress || to.trim() !== walletAddress) && (
            <div className="form-hint" style={{ color: 'var(--color-success)' }}>✓ Valid address</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Amount (OCT)</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="form-input"
            disabled={loading || sending}
          />
          <div className="form-hint">Available: {balance} OCT</div>
        </div>

        <div className="form-group">
          <label className="form-label">Priority</label>
          <div className="priority-selector">
            <div
              className={`priority-option ${priority === 'normal' ? 'selected' : ''}`}
              onClick={() => !loading && !sending && setPriority('normal')}
            >
              <span className="priority-label">🐢 Normal</span>
              <span className="priority-fee">0.001 OCT</span>
            </div>
            <div
              className={`priority-option ${priority === 'express' ? 'selected' : ''}`}
              onClick={() => !loading && !sending && setPriority('express')}
            >
              <span className="priority-label">⚡ Express</span>
              <span className="priority-fee">0.003 OCT</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: 'var(--spacing-3)' }}>{error}</div>
        )}

        {txHash && (
          <div className="security-notice" style={{ backgroundColor: 'var(--color-success-bg)', marginBottom: 'var(--spacing-3)' }}>
            <span className="security-notice-icon">✓</span>
            <span className="security-notice-text" style={{ color: 'var(--color-success)' }}>
              Sent! Hash: {txHash.slice(0, 20)}...
            </span>
          </div>
        )}

        <button
          type="submit"
          className="submit-btn"
          disabled={loading || sending || Boolean(addressError) || Boolean(to.trim() && !validateAddress(to.trim()))}
        >
          {sending ? 'Sending...' : 'Send Transaction'}
        </button>
      </form>
    </>
  );
}


