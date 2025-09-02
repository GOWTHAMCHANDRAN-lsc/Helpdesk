// Simple AES encryption/decryption for chat messages (Node.js)

import CryptoJS from 'crypto-js';

const SECRET = "helpdesk-secret-key"; // In production, use env vars and rotate keys

export function encryptMessage(message) {
  return CryptoJS.AES.encrypt(message, SECRET).toString();
}

export function decryptMessage(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
