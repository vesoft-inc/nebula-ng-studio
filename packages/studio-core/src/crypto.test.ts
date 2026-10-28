import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto.js';

describe('SM4 credential encryption', () => {
  it('round-trips UTF-8 credentials', () => {
    const message = 'Hello, this is a test message! 你好世界 123';
    const encrypted = encrypt(message);

    expect(encrypted).not.toContain(message);
    expect(decrypt(encrypted)).toBe(message);
  });

  it('uses a new initialization vector for every ciphertext', () => {
    const message = '["username","password"]';

    expect(encrypt(message)).not.toBe(encrypt(message));
  });

  it('rejects empty data and invalid keys', () => {
    expect(() => encrypt('')).toThrow('Data to encrypt cannot be empty');
    expect(() => encrypt('credentials', 'short')).toThrow('Secret key must be a 32-character hex string');
    expect(() => decrypt('', '39fbf051cc321eb3274a58179e7511ff')).toThrow('Encrypted data cannot be empty');
  });
});
