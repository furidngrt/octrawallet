import { useState } from 'react';
import type { WalletData } from '../types';
import { createWalletFromPrivateKey, loadWalletFromJSON, saveEncryptedWallet } from '../utils/wallet';
import { validatePrivateKey } from '../utils/crypto';
import { PassphrasePrompt } from './PassphrasePrompt';

interface WalletImportProps {
  onImport: (wallet: WalletData) => void;
}

export function WalletImport({ onImport }: WalletImportProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<WalletData | null>(null);

  const handleImport = async () => {
    setError('');

    if (!input.trim()) {
      setError('Please enter a private key or wallet JSON');
      return;
    }

    try {
      let wallet: WalletData;

      // Try to parse as JSON first
      if (input.trim().startsWith('{')) {
        wallet = await loadWalletFromJSON(input.trim());
      } else {
        // Assume it's a private key
        if (!validatePrivateKey(input.trim())) {
          setError('Invalid private key format');
          return;
        }
        wallet = await createWalletFromPrivateKey(input.trim());
      }

      // Store wallet temporarily and show passphrase prompt
      setPendingWallet(wallet);
      setShowPassphrase(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import wallet');
    }
  };

  const handlePassphraseSubmit = async (passphrase: string) => {
    if (!pendingWallet) return;

    try {
      // Encrypt and save wallet
      await saveEncryptedWallet(pendingWallet, passphrase);
      // Import wallet (decrypted in memory)
      onImport(pendingWallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to encrypt wallet');
      setShowPassphrase(false);
      setPendingWallet(null);
    }
  };

  const handlePassphraseCancel = () => {
    setShowPassphrase(false);
    setPendingWallet(null);
  };

  if (showPassphrase && pendingWallet) {
    return (
      <PassphrasePrompt
        onSubmit={handlePassphraseSubmit}
        onCancel={handlePassphraseCancel}
        title="Set Encryption Passphrase"
        isUnlock={false}
      />
    );
  }

  return (
    <div className="import-container">
      <div className="import-card">
        <div className="import-title">Import Wallet</div>
        <div className="import-subtitle">
          Enter your private key or wallet JSON to access your Octra wallet
        </div>

        <div className="security-notice">
          <span className="security-notice-icon">🔒</span>
          <div className="security-notice-text">
            <strong>Private keys NEVER leave your device.</strong> Keys are encrypted with your passphrase before storage. All transaction signing happens locally.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Private Key or Wallet JSON</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Private key (hex/base64) or {"priv":"...","addr":"...","rpc":"..."}'
            rows={5}
            className="form-input mono"
            style={{ resize: 'vertical', minHeight: '120px' }}
          />
        </div>

        {error && (
          <div className="security-notice" style={{ backgroundColor: 'var(--color-error-bg)', marginBottom: 'var(--spacing-4)' }}>
            <span className="security-notice-icon">⚠️</span>
            <span className="security-notice-text" style={{ color: 'var(--color-error)' }}>{error}</span>
          </div>
        )}

        <div className="security-notice" style={{ backgroundColor: 'var(--color-warning-bg)', marginBottom: 'var(--spacing-4)' }}>
          <span className="security-notice-icon">⚠️</span>
          <span className="security-notice-text" style={{ color: 'var(--color-warning)' }}>
            Never share your private key with anyone. Anyone with your private key can access your wallet.
          </span>
        </div>

        <button onClick={handleImport} className="submit-btn">
          Import Wallet
        </button>
      </div>
    </div>
  );
}
