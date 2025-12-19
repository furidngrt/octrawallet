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
  nonce,
  priority,
  onConfirm,
  onCancel,
}: SendConfirmationModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Confirm Transaction</h2>
        <p className="modal-subtitle">Please review transaction details before confirming</p>

        <div className="confirmation-details">
          <div className="confirmation-row">
            <span className="confirmation-label">To Address:</span>
            <div className="confirmation-value-full">
              <span className="full-address">{to}</span>
              <CopyButton text={to} className="tx-copy-btn-small" />
            </div>
          </div>

          <div className="confirmation-row">
            <span className="confirmation-label">Amount:</span>
            <span className="confirmation-value">{amount} OCT</span>
          </div>

          <div className="confirmation-row">
            <span className="confirmation-label">Nonce:</span>
            <span className="confirmation-value">{nonce}</span>
          </div>

          <div className="confirmation-row">
            <span className="confirmation-label">Priority:</span>
            <span className={`confirmation-badge priority-${priority}`}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onCancel} className="modal-btn cancel">
            Cancel
          </button>
          <button onClick={onConfirm} className="modal-btn confirm">
            Confirm & Send
          </button>
        </div>

        <div className="security-warning">
          <span className="warning-icon">⚠️</span>
          <span>This action cannot be undone. Make sure the recipient address is correct.</span>
        </div>
      </div>
    </div>
  );
}

