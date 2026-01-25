import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { WalletImport } from './components/WalletImport';
import { WalletView } from './components/WalletView';
import { TransactionsTab } from './components/TransactionsTab';
import { Navigation } from './components/Navigation';
import { PassphrasePrompt } from './components/PassphrasePrompt';
import { Footer } from './components/Footer';
import type { WalletData } from './types';
import {
  isWalletEncrypted,
  loadEncryptedWallet,
  isSessionValid,
  createUnlockSession,
  clearUnlockSession,
  tryAutoUnlock,
  cacheDecryptedWallet,
  clearDecryptedWalletCache,
  clearAllWalletData,
} from './utils/wallet';
import { clearNonceState, clearAllNonceStates } from './utils/nonceManager';
import { useNavigate } from 'react-router-dom';
import './App.css';

// Theme management
const getInitialTheme = (): 'light' | 'dark' => {
  const saved = localStorage.getItem('octra-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockError, setUnlockError] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const navigate = useNavigate();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('octra-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    // Check if wallet exists and if it's encrypted
    const encrypted = isWalletEncrypted();
    if (!encrypted) {
      return; // No wallet, nothing to unlock
    }

    // Check if we have a valid session (tab is still open, session not expired)
    if (isSessionValid()) {
      // Try to auto-unlock from session cache
      const autoUnlocked = tryAutoUnlock();
      if (autoUnlocked) {
        setWallet(autoUnlocked);
        setShowUnlock(false);
        return;
      }
    }

    // No valid session or auto-unlock failed, show unlock prompt
    setShowUnlock(true);
  }, []);

  const handleWalletImport = (walletData: WalletData) => {
    // Cache decrypted wallet in sessionStorage for session persistence
    cacheDecryptedWallet(walletData);

    // Create unlock session (1 hour duration)
    createUnlockSession(walletData.addr);

    setWallet(walletData);
    setShowUnlock(false);
  };

  const handleUnlock = async (passphrase: string) => {
    setUnlockError('');
    try {
      const unlocked = await loadEncryptedWallet(passphrase);
      if (unlocked) {
        // Cache decrypted wallet in sessionStorage (cleared when tab closes)
        cacheDecryptedWallet(unlocked);

        // Create unlock session (1 hour duration)
        createUnlockSession(unlocked.addr);

        setWallet(unlocked);
        setShowUnlock(false);
        setUnlockError('');
      } else {
        throw new Error('Invalid passphrase');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to unlock wallet';
      setUnlockError(errMsg);
      throw error; // Re-throw for PassphrasePrompt to handle
    }
  };

  const handleLock = () => {
    // Lock: Only clear decrypted key from memory and session
    // Keep encrypted wallet in localStorage
    if (wallet) {
      clearNonceState(wallet.addr);
      clearDecryptedWalletCache(wallet.addr);
    }
    clearUnlockSession(); // Clear sessionStorage
    setWallet(null);
    setShowUnlock(true); // Show unlock prompt
    setUnlockError(''); // Clear any errors
  };

  const handleLogout = () => {
    // Logout: Clear ALL wallet data (encrypted wallet + tx cache + nonce cache + session)
    if (wallet) {
      clearNonceState(wallet.addr);
    }

    // Clear all nonce states
    clearAllNonceStates();

    // Clear all wallet data from storage
    clearAllWalletData();

    // Reset state
    setWallet(null);
    setShowUnlock(false); // Don't show unlock, go to import screen
    setUnlockError('');

    // Navigate to import screen
    navigate('/', { replace: true });
  };

  // Show unlock prompt if wallet is encrypted but not loaded
  if (showUnlock && !wallet) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="logo">
              <div className="logo-ring"></div>
              <span className="logo-text">Octra Wallet</span>
            </div>
            <div className="header-actions">
              <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                {theme === 'light' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>
        <main className="app-main">
          <PassphrasePrompt
            onSubmit={handleUnlock}
            title="Unlock Wallet"
            isUnlock={true}
          />
          {unlockError && (
            <div className="import-container">
              <div className="security-notice" style={{ backgroundColor: 'var(--color-error-bg)' }}>
                <span className="security-notice-icon">⚠️</span>
                <span className="security-notice-text" style={{ color: 'var(--color-error)' }}>{unlockError}</span>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-ring"></div>
            <span className="logo-text">Octra Wallet</span>
          </div>
          {wallet && (
            <div className="header-actions">
              <button onClick={toggleTheme} className="theme-toggle" title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                {theme === 'light' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                )}
              </button>
              <button onClick={handleLock} className="btn btn-secondary btn-sm">
                🔒 Lock
              </button>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {wallet && (
        <Navigation />
      )}

      <main className="app-main">
        <div className="main-container">
          <Routes>
            <Route
              path="/"
              element={
                !wallet ? (
                  <WalletImport onImport={handleWalletImport} />
                ) : (
                  <WalletView wallet={wallet} />
                )
              }
            />
            <Route
              path="/Transactions"
              element={
                wallet ? (
                  <TransactionsTab wallet={wallet} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;

