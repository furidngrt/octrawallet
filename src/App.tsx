import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

function App() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockError, setUnlockError] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();

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
          <h1 className="app-logo">Octra Wallet</h1>
        </header>
        <main className="app-main">
          <PassphrasePrompt
            onSubmit={handleUnlock}
            title="Unlock Wallet"
            isUnlock={true}
          />
          {unlockError && (
            <div style={{ maxWidth: '500px', margin: '20px auto' }} className="error">
              {unlockError}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  // Determine active tab from route
  const activeTab = location.pathname === '/Transactions' ? 'transactions' : 'wallet';

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-logo">Octra Wallet</h1>
        {wallet && (
          <div className="header-actions">
            <button onClick={handleLock} className="lock-btn">
              Lock
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        )}
      </header>
      
      {wallet && (
        <Navigation activeTab={activeTab} />
      )}
      
      <main className="app-main">
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
      </main>
      
      <Footer />
    </div>
  );
}

export default App;

