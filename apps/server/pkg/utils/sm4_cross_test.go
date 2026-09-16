package utils

import (
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"testing"

	"github.com/emmansun/gmsm/sm4"
)

// Shared cross-language SM4-CBC vector.
//
// Every constant below must stay byte-identical to the constants in
// packages/utils/src/crypto.cross.test.ts, which asserts the same ciphertext.
// The two test files are the only automated guard for the frontend encrypt() ->
// server Sm4Decrypt() contract used by the Studio Authorization header.
const (
	crossVectorKey        = "39fbf051cc321eb3274a58179e7511ff"
	crossVectorIVHex      = "00112233445566778899aabbccddeeff"
	crossVectorPlaintext  = "Hello, this is a test message! 你好世界 123"
	crossVectorCiphertext = "ABEiM0RVZneImaq7zN3u/w6Mg17VDry+ae3IDTkYpfD6dtIBDdua/LRQ7cPt1MReb5lhruMx3Sw0IzfLR04YXQ=="
)

// TestCrossSm4EncryptMatchesTypeScriptVector pins Go's CBC output for the shared
// key/IV/plaintext to the exact vector asserted by the TypeScript side. Any drift
// in IV layout, PKCS7 padding or Base64 encoding fails here instead of in production.
func TestCrossSm4EncryptMatchesTypeScriptVector(t *testing.T) {
	keyBytes, err := hex.DecodeString(crossVectorKey)
	if err != nil {
		t.Fatalf("decode vector key: %v", err)
	}
	iv, err := hex.DecodeString(crossVectorIVHex)
	if err != nil {
		t.Fatalf("decode vector iv: %v", err)
	}
	block, err := sm4.NewCipher(keyBytes)
	if err != nil {
		t.Fatalf("new SM4 cipher: %v", err)
	}

	padded := pkcs7Pad([]byte(crossVectorPlaintext), sm4.BlockSize)
	mode := cipher.NewCBCEncrypter(block, iv)
	ciphertext := make([]byte, len(padded))
	mode.CryptBlocks(ciphertext, padded)

	encrypted := base64.StdEncoding.EncodeToString(append(append([]byte{}, iv...), ciphertext...))
	if encrypted != crossVectorCiphertext {
		t.Fatalf("Go SM4-CBC output drifted from the TypeScript vector: got %q, want %q", encrypted, crossVectorCiphertext)
	}
}

// TestCrossSm4DecryptsTypeScriptVector pins the production direction: the Base64
// emitted by the Studio frontend must stay decryptable by the server with the
// default credential key.
func TestCrossSm4DecryptsTypeScriptVector(t *testing.T) {
	decrypted, err := Sm4Decrypt(crossVectorCiphertext, "")
	if err != nil {
		t.Fatalf("decrypt shared vector: %v", err)
	}
	if string(decrypted) != crossVectorPlaintext {
		t.Fatalf("decrypt shared vector mismatch: got %q, want %q", decrypted, crossVectorPlaintext)
	}
}
