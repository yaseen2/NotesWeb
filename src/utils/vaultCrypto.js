// src/utils/vaultCrypto.js - Zero-Knowledge Client-Side Vault Security Engine
// Uses Web Crypto API (PBKDF2 + AES-256-GCM) for browser-level private vault protection.
// Completely local, private, and works on static hosts (Vercel, GitHub Pages) without a backend.

const CONFIG_KEY = 'notesweb_vault_auth_v1';
const SESSION_KEY = 'notesweb_vault_unlocked_session';
const SENTINEL_PLAINTEXT = 'NOTESWEB_AUTHENTICATED_ACCESS_VERIFIED';

/**
 * Derives an AES-GCM-256 key from a passphrase and salt using PBKDF2
 */
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Helper to convert ArrayBuffer to Base64
 */
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert Base64 to Uint8Array
 */
function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Checks if the vault is configured with a master password
 */
export function isVaultPasswordProtected() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return false;
    const config = JSON.parse(raw);
    return Boolean(config && config.salt && config.sentinelCiphertext);
  } catch (e) {
    return false;
  }
}

/**
 * Checks if the vault is currently unlocked in this browser session
 */
export function isVaultUnlocked() {
  if (!isVaultPasswordProtected()) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Locks the vault immediately by clearing the session token
 */
export function lockVault() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

/**
 * Configures or changes the master password for the vault
 */
export async function setVaultPassword(newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(newPassword, salt);

  const enc = new TextEncoder();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(SENTINEL_PLAINTEXT)
  );

  const config = {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    sentinelCiphertext: bufferToBase64(ciphertextBuffer),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  sessionStorage.setItem(SESSION_KEY, 'true');
  return true;
}

/**
 * Verifies a passphrase to unlock the vault for the current session
 */
export async function unlockVault(passphrase) {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return true; // No password set
    const config = JSON.parse(raw);

    const salt = base64ToBuffer(config.salt);
    const iv = base64ToBuffer(config.iv);
    const ciphertext = base64ToBuffer(config.sentinelCiphertext);

    const key = await deriveKey(passphrase, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const resultText = dec.decode(decryptedBuffer);

    if (resultText === SENTINEL_PLAINTEXT) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
  } catch (err) {
    console.warn('Vault unlock attempt failed:', err);
  }
  return false;
}

/**
 * Removes password protection from the vault (requires valid current password)
 */
export async function removeVaultPassword(currentPassword) {
  const isValid = await unlockVault(currentPassword);
  if (!isValid) {
    throw new Error('Current password is incorrect.');
  }
  localStorage.removeItem(CONFIG_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return true;
}
