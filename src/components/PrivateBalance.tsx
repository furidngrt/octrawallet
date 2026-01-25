import { useState, useEffect } from 'react';
import { getEncryptedBalance, type EncryptedBalanceData } from '../utils/rpc';
import { encryptClientBalance } from '../utils/privateBalance';

const MICRO_OCT = 1_000_000;

// Use backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface PrivateBalanceProps {
    walletAddress: string;
    privateKey: string;
    onRefresh?: () => void;
}

export function PrivateBalance({ walletAddress, privateKey, onRefresh }: PrivateBalanceProps) {
    const [balanceData, setBalanceData] = useState<EncryptedBalanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [mode, setMode] = useState<'view' | 'encrypt' | 'decrypt'>('view');
    const [amount, setAmount] = useState('');

    const fetchBalance = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getEncryptedBalance(walletAddress, privateKey);
            setBalanceData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch balance');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [walletAddress, privateKey]);

    const handleEncrypt = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        const amountNum = parseFloat(amount);
        if (amountNum > (balanceData?.public_balance || 0)) {
            setError('Insufficient public balance');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            // Calculate new encrypted balance (current + amount to encrypt)
            const currentEncryptedRaw = balanceData?.encrypted_balance_raw || 0;
            const amountRaw = Math.floor(amountNum * MICRO_OCT);
            const newEncryptedRaw = currentEncryptedRaw + amountRaw;

            // Encrypt the new balance value client-side
            const encryptedData = await encryptClientBalance(newEncryptedRaw, privateKey);

            // Send to RPC
            const response = await fetch(`${API_BASE_URL}/api/encrypt-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: walletAddress,
                    amount: String(amountRaw),
                    private_key: privateKey,
                    encrypted_data: encryptedData,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            setSuccess(`Encrypted ${amount} OCT successfully!`);
            setAmount('');
            setMode('view');
            await fetchBalance();
            onRefresh?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Encrypt failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDecrypt = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        const amountNum = parseFloat(amount);
        if (amountNum > (balanceData?.encrypted_balance || 0)) {
            setError('Insufficient encrypted balance');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccess('');

        try {
            // Calculate new encrypted balance (current - amount to decrypt)
            const currentEncryptedRaw = balanceData?.encrypted_balance_raw || 0;
            const amountRaw = Math.floor(amountNum * MICRO_OCT);
            const newEncryptedRaw = currentEncryptedRaw - amountRaw;

            if (newEncryptedRaw < 0) {
                throw new Error('Insufficient encrypted balance');
            }

            // Encrypt the new balance value client-side
            const encryptedData = await encryptClientBalance(newEncryptedRaw, privateKey);

            // Send to RPC
            const response = await fetch(`${API_BASE_URL}/api/decrypt-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: walletAddress,
                    amount: String(amountRaw),
                    private_key: privateKey,
                    encrypted_data: encryptedData,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            setSuccess(`Decrypted ${amount} OCT successfully!`);
            setAmount('');
            setMode('view');
            await fetchBalance();
            onRefresh?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Decrypt failed');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="private-section">
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading private balance...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="private-section">
            <div className="private-header">
                <div className="private-icon">🔐</div>
                <div>
                    <div className="private-title">Private Balance</div>
                    <div className="private-subtitle">Encrypt & decrypt your OCT</div>
                </div>
            </div>

            {/* Balance Cards */}
            <div className="balance-cards">
                <div className="balance-card">
                    <div className="balance-card-label">Public Balance</div>
                    <div className="balance-card-value">
                        {balanceData?.public_balance?.toFixed(6) || '0'} OCT
                    </div>
                </div>
                <div className="balance-card">
                    <div className="balance-card-label">Encrypted Balance</div>
                    <div className="balance-card-value encrypted">
                        🔒 {balanceData?.encrypted_balance?.toFixed(6) || '0'} OCT
                    </div>
                </div>
            </div>

            {/* Action Mode */}
            {mode === 'view' && (
                <div className="action-buttons">
                    <button
                        className="action-btn"
                        onClick={() => setMode('encrypt')}
                        disabled={!balanceData?.public_balance || balanceData.public_balance <= 0}
                    >
                        <span className="action-btn-icon">🔒</span>
                        Encrypt
                    </button>
                    <button
                        className="action-btn"
                        onClick={() => setMode('decrypt')}
                        disabled={!balanceData?.encrypted_balance || balanceData.encrypted_balance <= 0}
                    >
                        <span className="action-btn-icon">🔓</span>
                        Decrypt
                    </button>
                    <button className="action-btn" onClick={fetchBalance}>
                        <span className="action-btn-icon">🔄</span>
                        Refresh
                    </button>
                </div>
            )}

            {/* Encrypt Form */}
            {mode === 'encrypt' && (
                <div className="encrypt-form">
                    <div className="form-group">
                        <label className="form-label">Amount to Encrypt (OCT)</label>
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            className="form-input"
                            disabled={actionLoading}
                        />
                        <div className="form-hint">
                            Available: {balanceData?.public_balance?.toFixed(6) || '0'} OCT
                        </div>
                    </div>
                    <div className="form-actions">
                        <button
                            className="btn-uniform btn-primary"
                            onClick={handleEncrypt}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Encrypting...' : '🔒 Encrypt'}
                        </button>
                        <button
                            className="btn-uniform btn-secondary"
                            onClick={() => { setMode('view'); setAmount(''); setError(''); }}
                            disabled={actionLoading}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Decrypt Form */}
            {mode === 'decrypt' && (
                <div className="decrypt-form">
                    <div className="form-group">
                        <label className="form-label">Amount to Decrypt (OCT)</label>
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.0"
                            className="form-input"
                            disabled={actionLoading}
                        />
                        <div className="form-hint">
                            Available: {balanceData?.encrypted_balance?.toFixed(6) || '0'} OCT
                        </div>
                    </div>
                    <div className="form-actions">
                        <button
                            className="btn-uniform btn-primary"
                            onClick={handleDecrypt}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Decrypting...' : '🔓 Decrypt'}
                        </button>
                        <button
                            className="btn-uniform btn-secondary"
                            onClick={() => { setMode('view'); setAmount(''); setError(''); }}
                            disabled={actionLoading}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Error/Success Messages */}
            {error && (
                <div className="security-notice" style={{ backgroundColor: 'var(--color-error-bg)', marginTop: 'var(--spacing-4)' }}>
                    <span className="security-notice-icon">⚠️</span>
                    <span className="security-notice-text" style={{ color: 'var(--color-error)' }}>{error}</span>
                </div>
            )}

            {success && (
                <div className="security-notice" style={{ backgroundColor: 'var(--color-success-bg)', marginTop: 'var(--spacing-4)' }}>
                    <span className="security-notice-icon">✓</span>
                    <span className="security-notice-text" style={{ color: 'var(--color-success)' }}>{success}</span>
                </div>
            )}
        </div>
    );
}
