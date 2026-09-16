import { describe, expect, it } from 'vitest';
import { sm4 } from 'sm-crypto';
import { decrypt } from './crypto';

/**
 * Shared cross-language SM4-CBC vector.
 *
 * Every constant below must stay byte-identical to the constants in
 * apps/server/pkg/utils/sm4_cross_test.go, which asserts the same ciphertext.
 * The two test files are the only automated guard for the frontend encrypt() ->
 * server Sm4Decrypt() contract used by the Studio Authorization header.
 */
const CROSS_VECTOR_KEY = '39fbf051cc321eb3274a58179e7511ff';
const CROSS_VECTOR_IV_HEX = '00112233445566778899aabbccddeeff';
const CROSS_VECTOR_PLAINTEXT = 'Hello, this is a test message! 你好世界 123';
const CROSS_VECTOR_CIPHERTEXT =
  'ABEiM0RVZneImaq7zN3u/w6Mg17VDry+ae3IDTkYpfD6dtIBDdua/LRQ7cPt1MReb5lhruMx3Sw0IzfLR04YXQ==';

const hexToBase64 = (hex: string) => {
  const bytes = hex.match(/.{2}/g)?.map((byte) => String.fromCharCode(Number.parseInt(byte, 16))) ?? [];
  return btoa(bytes.join(''));
};

describe('Go/TypeScript SM4 compatibility', () => {
  it('produces the exact ciphertext asserted by the Go implementation', () => {
    const ciphertextHex = sm4.encrypt(CROSS_VECTOR_PLAINTEXT, CROSS_VECTOR_KEY, {
      mode: 'cbc',
      iv: CROSS_VECTOR_IV_HEX,
    });
    const encrypted = hexToBase64(CROSS_VECTOR_IV_HEX + ciphertextHex);

    expect(encrypted).toBe(CROSS_VECTOR_CIPHERTEXT);
  });

  it('decrypts the ciphertext produced by the Go implementation', () => {
    expect(decrypt(CROSS_VECTOR_CIPHERTEXT)).toBe(CROSS_VECTOR_PLAINTEXT);
  });
});
