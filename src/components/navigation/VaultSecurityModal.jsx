// src/components/navigation/VaultSecurityModal.jsx - Security & Password Settings Modal
import React, { useState } from 'react';
import {
  isVaultPasswordProtected,
  setVaultPassword,
  removeVaultPassword,
  lockVault,
} from '../../utils/vaultCrypto';
import { Shield, ShieldAlert, Lock, Unlock, X, Check, Key } from 'lucide-react';

export default function VaultSecurityModal({ isOpen, onClose, onPasswordChanged, onLockNow }) {
  const isProtected = isVaultPasswordProtected();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsProcessing(true);
    try {
      await setVaultPassword(newPassword);
      setIsProcessing(false);
      setSuccess('Vault master password configured successfully!');
      setNewPassword('');
      setConfirmPassword('');
      if (onPasswordChanged) onPasswordChanged();
    } catch (err) {
      setIsProcessing(false);
      setError(err.message || 'Failed to set password.');
    }
  };

  const handleRemovePassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Please enter your current master password.');
      return;
    }

    setIsProcessing(true);
    try {
      await removeVaultPassword(currentPassword);
      setIsProcessing(false);
      setSuccess('Password protection removed. Vault is now openly accessible.');
      setCurrentPassword('');
      if (onPasswordChanged) onPasswordChanged();
    } catch (err) {
      setIsProcessing(false);
      setError('Incorrect current password.');
    }
  };

  const handleLock = () => {
    lockVault();
    onClose();
    if (onLockNow) onLockNow();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card vault-security-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Shield size={18} className="modal-icon text-accent" />
            <h3 className="modal-heading">Vault Privacy & Encryption</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Current Status Banner */}
          <div className={`vault-status-banner ${isProtected ? 'is-protected' : 'is-unprotected'}`}>
            {isProtected ? (
              <>
                <Lock size={18} className="status-icon" />
                <div>
                  <strong>Vault is Encrypted & Protected</strong>
                  <p>Access requires master passphrase on new browser sessions.</p>
                </div>
              </>
            ) : (
              <>
                <Unlock size={18} className="status-icon" />
                <div>
                  <strong>Vault is Open (No Password)</strong>
                  <p>Set a passphrase to prevent unauthorized access on this device.</p>
                </div>
              </>
            )}
          </div>

          {error && <div className="modal-error-alert">{error}</div>}
          {success && <div className="modal-success-alert">{success}</div>}

          {/* Form to Set Password */}
          {!isProtected ? (
            <form onSubmit={handleSetPassword} className="vault-security-form">
              <label className="form-label">Create Master Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="New passphrase (min 4 characters)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <label className="form-label" style={{ marginTop: '0.65rem' }}>
                Confirm Master Password
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Re-type passphrase..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: '1.25rem' }}
                disabled={isProcessing || !newPassword}
              >
                <Lock size={14} />
                <span>{isProcessing ? 'Encrypting...' : 'Protect Vault with Password'}</span>
              </button>
            </form>
          ) : (
            <div className="vault-protected-actions">
              <button
                className="btn btn-primary btn-block"
                onClick={handleLock}
                title="Lock vault immediately"
              >
                <Lock size={14} />
                <span>Lock Vault Now</span>
              </button>

              <hr style={{ margin: '1.5rem 0', borderColor: 'var(--border-color)' }} />

              <form onSubmit={handleRemovePassword}>
                <label className="form-label">Remove Password Protection</label>
                <p className="form-hint">Enter your current passphrase to disable password protection.</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Current password..."
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={isProcessing || !currentPassword}
                  >
                    <span>Remove</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
