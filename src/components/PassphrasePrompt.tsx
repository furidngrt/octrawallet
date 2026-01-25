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
    <div className="import-container">
      <div className="import-card">
        <div className="import-title">{title}</div>
        <div className="import-subtitle">
          {isUnlock
            ? 'Enter your passphrase to unlock your wallet'
            : 'Set a secure passphrase to encrypt your private key (minimum 8 characters)'}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Passphrase</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                className="form-input"
                autoFocus
                style={{ paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="copy-button"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}
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

          {error && (
            <div className="security-notice" style={{ backgroundColor: 'var(--color-error-bg)', marginBottom: 'var(--spacing-4)' }}>
              <span className="security-notice-icon">⚠️</span>
              <span className="security-notice-text" style={{ color: 'var(--color-error)' }}>{error}</span>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 'var(--spacing-4)' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: onCancel ? 1 : 'none', width: onCancel ? 'auto' : '100%' }}>
              {loading ? 'Processing...' : isUnlock ? 'Unlock' : 'Encrypt & Import'}
            </button>
          </div>
        </form>

        <div className="security-notice" style={{ backgroundColor: 'var(--color-warning-bg)', marginTop: 'var(--spacing-4)' }}>
          <span className="security-notice-icon">⚠️</span>
          <span className="security-notice-text" style={{ color: 'var(--color-warning)' }}>
            If you forget your passphrase, you cannot recover your wallet. Keep it safe and never share it.
          </span>
        </div>
      </div>
    </div>
  );
}
