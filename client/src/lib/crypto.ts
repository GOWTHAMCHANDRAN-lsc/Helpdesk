// Simple AES encryption/decryption for chat messages
import CryptoJS from "crypto-js";

const SECRET = "helpdesk-secret-key"; // In production, use env vars and rotate keys

export function encryptMessage(message: string): string {
  return CryptoJS.AES.encrypt(message, SECRET).toString();
}

export function decryptMessage(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
