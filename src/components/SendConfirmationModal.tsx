import { CopyButton } from './CopyButton';

interface SendConfirmationModalProps {
  to: string;
  amount: string;
  nonce: number;
  priority: 'normal' | 'express';
  onConfirm: () => void;
  onCancel: () => void;
}

export function SendConfirmationModal({
  to,
  amount,
  priority,
  onConfirm,
  onCancel,
}: SendConfirmationModalProps) {
  const fee = priority === 'express' ? '0.003' : '0.001';
  const total = (parseFloat(amount) + parseFloat(fee)).toFixed(6);

  return (
    <div className="modal-overlay">
      <div className="modal-content confirm-modal">
        {/* Header */}
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </div>
          <h2>Confirm Transaction</h2>
          <p className="confirm-modal-subtitle">Review the details before sending</p>
        </div>

        {/* Summary Card */}
        <div className="confirm-summary">
          <div className="confirm-summary-amount">
            <span className="oct-icon-lg">◎</span>
            <span className="confirm-amount-value">{amount}</span>
            <span className="confirm-amount-unit">OCT</span>
          </div>
        </div>

        {/* Details */}
        <div className="confirm-details">
          <div className="confirm-row">
            <span className="confirm-label">Recipient</span>
            <div className="confirm-address">
              <span className="confirm-address-text">{to.slice(0, 12)}...{to.slice(-8)}</span>
              <CopyButton text={to} className="copy-btn" />
            </div>
          </div>

          <div className="confirm-row">
            <span className="confirm-label">Network Fee</span>
            <span className="confirm-value">{fee} OCT</span>
          </div>

          <div className="confirm-row">
            <span className="confirm-label">Priority</span>
            <span className={`badge ${priority === 'express' ? 'badge-warning' : 'badge-primary'}`}>
              {priority === 'express' ? '⚡ Express' : '🐢 Normal'}
            </span>
          </div>

          <div className="confirm-row confirm-total">
            <span className="confirm-label">Total</span>
            <span className="confirm-value-total">{total} OCT</span>
          </div>
        </div>

        {/* Warning */}
        <div className="confirm-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>This transaction cannot be reversed. Please verify the recipient address.</span>
        </div>

        {/* Actions */}
        <div className="confirm-actions">
          <button onClick={onCancel} className="btn-uniform btn-secondary" style={{ flex: 1 }}>
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-uniform btn-primary" style={{ flex: 2 }}>
            Confirm & Send
          </button>
        </div>
      </div>
    </div>
  );
}
