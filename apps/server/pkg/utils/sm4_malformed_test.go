package utils

import (
	"bytes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"testing"

	"github.com/emmansun/gmsm/sm4"
	"github.com/stretchr/testify/require"
)

func TestSm4DecryptRejectsMalformedInputWithoutPanic(t *testing.T) {
	validCiphertext, err := Sm4Encrypt([]byte("alice"), "")
	require.NoError(t, err)

	invalidPaddingCiphertext := encryptSM4BlockForTest(t, make([]byte, sm4.BlockSize))
	randomCiphertext := make([]byte, sm4.BlockSize*2)
	_, err = rand.Read(randomCiphertext)
	require.NoError(t, err)

	tests := []struct {
		name              string
		ciphertext        string
		wantErr           string
		wantDecrypted     string
		onlyAssertNoPanic bool
	}{
		{
			name:       "zero bytes",
			ciphertext: "",
			wantErr:    "encrypted data cannot be empty",
		},
		{
			name:       "one byte",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 1)),
			wantErr:    "ciphertext too short",
		},
		{
			name:       "fifteen bytes",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 15)),
			wantErr:    "ciphertext too short",
		},
		{
			name:       "iv only",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize)),
			wantErr:    "ciphertext too short",
		},
		{
			name:       "seventeen bytes",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize+1)),
			wantErr:    "invalid ciphertext length",
		},
		{
			name:       "thirty one bytes",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 31)),
			wantErr:    "invalid ciphertext length",
		},
		{
			name:       "invalid padding",
			ciphertext: invalidPaddingCiphertext,
			wantErr:    "invalid padding",
		},
		{
			name:          "valid padding",
			ciphertext:    validCiphertext,
			wantDecrypted: "alice",
		},
		{
			name:       "thirty three bytes",
			ciphertext: base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize*2+1)),
			wantErr:    "invalid ciphertext length",
		},
		{
			name:       "invalid base64",
			ciphertext: "not base64!",
			wantErr:    "illegal base64 data",
		},
		{
			name:              "random ciphertext with valid length",
			ciphertext:        base64.StdEncoding.EncodeToString(randomCiphertext),
			onlyAssertNoPanic: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var decrypted []byte
			var decryptErr error
			require.NotPanics(t, func() {
				decrypted, decryptErr = Sm4Decrypt(tt.ciphertext, "")
			})

			if tt.onlyAssertNoPanic {
				return
			}
			if tt.wantDecrypted != "" {
				require.NoError(t, decryptErr)
				require.Equal(t, tt.wantDecrypted, string(decrypted))
				return
			}

			require.Error(t, decryptErr)
			require.Contains(t, decryptErr.Error(), tt.wantErr)
		})
	}
}

func TestPKCS7UnpadRejectsInvalidInputWithoutPanic(t *testing.T) {
	tests := []struct {
		name      string
		input     []byte
		blockSize int
		wantErr   bool
		want      []byte
	}{
		{
			name:      "empty input",
			blockSize: sm4.BlockSize,
			wantErr:   true,
		},
		{
			name:      "misaligned input",
			input:     []byte{1},
			blockSize: sm4.BlockSize,
			wantErr:   true,
		},
		{
			name:      "zero block size",
			input:     []byte{1, 2, 3},
			blockSize: 0,
			wantErr:   true,
		},
		{
			name:      "block size cannot fit one byte",
			input:     make([]byte, 256),
			blockSize: 256,
			wantErr:   true,
		},
		{
			name:      "zero padding",
			input:     make([]byte, sm4.BlockSize),
			blockSize: sm4.BlockSize,
			wantErr:   true,
		},
		{
			name: "padding exceeds block size",
			input: append(
				bytes.Repeat([]byte{'a'}, sm4.BlockSize-1),
				byte(sm4.BlockSize+1),
			),
			blockSize: sm4.BlockSize,
			wantErr:   true,
		},
		{
			name: "inconsistent padding",
			input: append(
				append(bytes.Repeat([]byte{'a'}, sm4.BlockSize-2), 3),
				2,
			),
			blockSize: sm4.BlockSize,
			wantErr:   true,
		},
		{
			name: "valid padding",
			input: append(
				bytes.Repeat([]byte{'a'}, sm4.BlockSize-3),
				3, 3, 3,
			),
			blockSize: sm4.BlockSize,
			want:      bytes.Repeat([]byte{'a'}, sm4.BlockSize-3),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var unpadded []byte
			var unpadErr error
			require.NotPanics(t, func() {
				unpadded, unpadErr = pkcs7Unpad(tt.input, tt.blockSize)
			})

			if tt.wantErr {
				require.EqualError(t, unpadErr, "invalid padding")
				require.Nil(t, unpadded)
				return
			}
			require.NoError(t, unpadErr)
			require.Equal(t, tt.want, unpadded)
		})
	}
}

func FuzzSm4Decrypt(f *testing.F) {
	validCiphertext, err := Sm4Encrypt([]byte("alice"), "")
	if err != nil {
		f.Fatalf("create valid fuzz seed: %v", err)
	}

	seeds := []string{
		"",
		base64.StdEncoding.EncodeToString(make([]byte, 1)),
		base64.StdEncoding.EncodeToString(make([]byte, 15)),
		base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize)),
		base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize+1)),
		base64.StdEncoding.EncodeToString(make([]byte, 31)),
		base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize*2)),
		base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize*2+1)),
		"not base64!",
		validCiphertext,
	}
	for _, seed := range seeds {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, encrypted string) {
		require.NotPanics(t, func() {
			_, _ = Sm4Decrypt(encrypted, "")
		})
	})
}

func encryptSM4BlockForTest(t *testing.T, plaintext []byte) string {
	t.Helper()
	require.Len(t, plaintext, sm4.BlockSize)

	key, err := hex.DecodeString(DEFAULT_SM4_CREDENTIAL_ENCRYPTION_KEY)
	require.NoError(t, err)
	block, err := sm4.NewCipher(key)
	require.NoError(t, err)

	iv := make([]byte, sm4.BlockSize)
	ciphertext := make([]byte, len(plaintext))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, plaintext)

	combined := make([]byte, 0, len(iv)+len(ciphertext))
	combined = append(combined, iv...)
	combined = append(combined, ciphertext...)
	return base64.StdEncoding.EncodeToString(combined)
}
