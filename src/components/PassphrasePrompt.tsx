import { useState } from 'react';

interface PassphrasePromptProps {
  onSubmit: (passphrase: string) => Promise<void> | void;
  onCancel?: () => void;
  title?: string;
  isUnlock?: boolean;
}

export function PassphrasePrompt({
  onSubmit,
  onCancel,
  title = 'Enter Passphrase',
  isUnlock = false,
}: PassphrasePromptProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passphrase) {
      setError('Passphrase is required');
      return;
    }

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    if (!isUnlock) {
      // For setting new passphrase, require confirmation
      if (passphrase !== confirmPassphrase) {
        setError('Passphrases do not match');
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="passphrase-modal-overlay">
      <div className="passphrase-modal">
        <h2>{title}</h2>
        <p className="passphrase-hint">
          {isUnlock
            ? 'Enter your passphrase to unlock your wallet'
            : 'Set a secure passphrase to encrypt your private key (minimum 8 characters)'}
        </p>

        <form onSubmit={handleSubmit} className="passphrase-form">
          <div className="form-group">
            <label className="form-label">Passphrase</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                className="form-input"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {!isUnlock && (
            <div className="form-group">
              <label className="form-label">Confirm Passphrase</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm passphrase"
                className="form-input"
              />
            </div>
          )}

          {error && <div className="error-small">{error}</div>}

          <div className="passphrase-modal-actions">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="passphrase-btn cancel"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="passphrase-btn primary" disabled={loading}>
              {loading ? 'Processing...' : isUnlock ? 'Unlock' : 'Encrypt & Import'}
            </button>
          </div>
        </form>

        <div className="security-warning">
          <span className="warning-icon">⚠️</span>
          <span>
            If you forget your passphrase, you cannot recover your wallet. Keep it
            safe and never share it.
          </span>
        </div>
      </div>
    </div>
  );
}

