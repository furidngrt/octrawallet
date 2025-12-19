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

      <div className="send-card">
        <h3 className="section-title">Send</h3>
        <form onSubmit={handleSubmit} className="send-form">
          <div className="form-group">
            <label className="form-label">To Address</label>
            <input
              type="text"
              value={to}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="oct..."
              className={`form-input ${addressError ? 'input-error' : to.trim() && validateAddress(to.trim()) && (!walletAddress || to.trim() !== walletAddress) ? 'input-valid' : ''}`}
              disabled={loading || sending}
            />
            {addressError && <div className="error-small">{addressError}</div>}
            {to.trim() && !addressError && validateAddress(to.trim()) && (!walletAddress || to.trim() !== walletAddress) && (
              <div className="success-small" style={{ color: '#060', fontSize: '12px', marginTop: '4px' }}>✓ Valid address</div>
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
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <div className="priority-toggle">
              <button
                type="button"
                className={`priority-btn ${priority === 'normal' ? 'active' : ''}`}
                onClick={() => setPriority('normal')}
                disabled={loading || sending}
              >
                Normal
              </button>
              <button
                type="button"
                className={`priority-btn ${priority === 'express' ? 'active' : ''}`}
                onClick={() => setPriority('express')}
                disabled={loading || sending}
              >
                Express
              </button>
            </div>
          </div>
          {error && <div className="error-small">{error}</div>}
          {txHash && (
            <div className="success-small">
              ✓ Sent! <span className="tx-hash-link">{txHash.slice(0, 16)}...</span>
            </div>
          )}
          <button
            type="submit"
            className="send-btn"
            disabled={loading || sending || Boolean(addressError) || Boolean(to.trim() && !validateAddress(to.trim()))}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </>
  );
}

