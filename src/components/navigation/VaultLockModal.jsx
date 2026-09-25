// src/components/navigation/VaultLockModal.jsx - Minimalist Zero-Knowledge Vault Unlock Screen
import React, { useState } from 'react';
import { unlockVault } from '../../utils/vaultCrypto';
import { Lock, KeyRound, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function VaultLockModal({ isOpen, onUnlocked }) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setIsVerifying(true);
    setError(null);

    const success = await unlockVault(passphrase.trim());
    setIsVerifying(false);

    if (success) {
      onUnlocked();
    } else {
      setError('Incorrect master passphrase. Please try again.');
    }
  };

  return (
    <div className="vault-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="vault-lock-title">
      <div className="vault-lock-card">
        <div className="vault-lock-icon-wrapper">
          <div className="vault-lock-icon-halo">
            <Lock size={32} className="vault-lock-icon" />
          </div>
        </div>

        <h2 id="vault-lock-title" className="vault-lock-title">
          Private Study Vault
        </h2>
        <p className="vault-lock-subtitle">
          Protected with client-side AES-256 encryption. Enter your master passphrase to unlock notes and documents.
        </p>

        <form onSubmit={handleSubmit} className="vault-lock-form">
          <div className="vault-lock-input-group">
            <KeyRound size={16} className="vault-lock-input-icon" />
            <input
              type="password"
              className="vault-lock-input"
              placeholder="Enter master password..."
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="vault-lock-error" role="alert">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary vault-lock-submit-btn"
            disabled={isVerifying || !passphrase.trim()}
          >
            <span>{isVerifying ? 'Decrypting Vault...' : 'Unlock Vault'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="vault-lock-footer-info">
          <ShieldCheck size={13} />
          <span>Zero-Knowledge Security: Decrypted locally in your browser sandbox</span>
        </div>
      </div>
    </div>
  );
}
