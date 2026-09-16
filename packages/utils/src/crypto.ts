/**
 * SM4-CBC encryption for auth headers.
 * Compatible with Go backend SM4-CBC decryption in apps/server/pkg/utils/sm4.go
 *
 * Output format: Base64(iv || ciphertext)
 * - iv: 16 bytes (SM4 block size)
 * - ciphertext: PKCS7-padded, variable length
 *
 * Library: sm-crypto (https://github.com/JuneAndGreen/sm-crypto)
 * - sm4.encrypt: UTF-8 string -> hex string (PKCS7 padded by default)
 * - sm4.decrypt: hex string -> UTF-8 string (PKCS7 unpadded by default)
 */

import { sm4 } from 'sm-crypto';

const DEFAULT_CREDENTIAL_ENCRYPTION_KEY = '39fbf051cc321eb3274a58179e7511ff';

function randomIvHex(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBase64(hex: string): string {
  const binary = hex
    .match(/.{2}/g)!
    .map((b) => String.fromCharCode(parseInt(b, 16)))
    .join('');
  return btoa(binary);
}

function base64ToHex(b64: string): string {
  const binary = atob(b64);
  return Array.from(binary, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt data using SM4-CBC
 * Compatible with Go backend SM4-CBC decryption in apps/server/pkg/utils/sm4.go
 *
 * Output format: Base64(iv || ciphertext)
 */
export const encrypt = (data: string, secretKey: string = DEFAULT_CREDENTIAL_ENCRYPTION_KEY): string => {
  if (!data) {
    throw new Error('Data to encrypt cannot be empty');
  }
  if (!secretKey || secretKey.length !== 32 || !/^[0-9a-fA-F]+$/.test(secretKey)) {
    throw new Error('Secret key must be a 32-character hex string (128-bit key)');
  }

  const iv = randomIvHex();

  // SM4-CBC encrypt (PKCS7 padding applied automatically by sm-crypto)
  const ciphertextHex = sm4.encrypt(data, secretKey, {
    mode: 'cbc',
    iv,
  });

  // Combine: iv || ciphertext -> Base64
  return hexToBase64(iv + ciphertextHex);
};

/**
 * Decrypt data using SM4-CBC
 * Compatible with Go backend SM4-CBC encryption in apps/server/pkg/utils/sm4.go
 *
 * Expected input format: Base64(iv || ciphertext)
 */
export const decrypt = (encryptedData: string, secretKey: string = DEFAULT_CREDENTIAL_ENCRYPTION_KEY): string => {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }
  if (!secretKey || secretKey.length !== 32 || !/^[0-9a-fA-F]+$/.test(secretKey)) {
    throw new Error('Secret key must be a 32-character hex string (128-bit key)');
  }

  const combinedHex = base64ToHex(encryptedData);

  // IV is 16 bytes = 32 hex chars
  if (combinedHex.length < 64) {
    throw new Error('Encrypted data is too short');
  }

  const iv = combinedHex.slice(0, 32);
  const ciphertextHex = combinedHex.slice(32);

  return sm4.decrypt(ciphertextHex, secretKey, {
    mode: 'cbc',
    iv,
  });
};
