package utils

import (
	"bytes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"

	"github.com/emmansun/gmsm/sm4"
)

const DEFAULT_SM4_CREDENTIAL_ENCRYPTION_KEY = "39fbf051cc321eb3274a58179e7511ff"

func Sm4Encrypt(data []byte, passphrase string) (string, error) {
	if len(data) == 0 {
		return "", errors.New("data to encrypt cannot be empty")
	}
	if passphrase == "" {
		passphrase = DEFAULT_SM4_CREDENTIAL_ENCRYPTION_KEY
	}
	keyBytes, err := hex.DecodeString(passphrase)
	if err != nil {
		return "", errors.New("passphrase must be a valid hex string")
	}
	if len(keyBytes) != 16 {
		return "", errors.New("passphrase must be a 32-character hex string (128-bit key)")
	}

	block, err := sm4.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	// PKCS7 padding
	padded := pkcs7Pad(data, sm4.BlockSize)

	// Random IV
	iv := make([]byte, sm4.BlockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	// CBC encrypt
	mode := cipher.NewCBCEncrypter(block, iv)
	ciphertext := make([]byte, len(padded))
	mode.CryptBlocks(ciphertext, padded)

	// Combine: iv || ciphertext
	combined := append(iv, ciphertext...)
	return base64.StdEncoding.EncodeToString(combined), nil
}

func Sm4Decrypt(encrypted string, passphrase string) ([]byte, error) {
	if encrypted == "" {
		return nil, errors.New("encrypted data cannot be empty")
	}
	if passphrase == "" {
		passphrase = DEFAULT_SM4_CREDENTIAL_ENCRYPTION_KEY
	}
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, err
	}

	keyBytes, err := hex.DecodeString(passphrase)
	if err != nil {
		return nil, errors.New("passphrase must be a valid hex string")
	}
	if len(keyBytes) != 16 {
		return nil, errors.New("passphrase must be a 32-character hex string (128-bit key)")
	}

	block, err := sm4.NewCipher(keyBytes)
	if err != nil {
		return nil, err
	}

	if len(data) < sm4.BlockSize {
		return nil, errors.New("ciphertext too short")
	}

	iv := data[:sm4.BlockSize]
	ciphertext := data[sm4.BlockSize:]

	if len(ciphertext)%sm4.BlockSize != 0 {
		return nil, errors.New("ciphertext is not a multiple of the block size")
	}

	// CBC decrypt
	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)

	// Remove PKCS7 padding.
	return pkcs7Unpad(plaintext, sm4.BlockSize)
}

func pkcs7Pad(input []byte, blockSize int) []byte {
	padding := blockSize - len(input)%blockSize
	return append(input, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

func pkcs7Unpad(input []byte, blockSize int) ([]byte, error) {
	padding := int(input[len(input)-1])
	if padding < 1 || padding > blockSize {
		return nil, errors.New("invalid padding")
	}
	for i := 0; i < padding; i++ {
		if input[len(input)-padding+i] != byte(padding) {
			return nil, errors.New("invalid padding")
		}
	}
	return input[:len(input)-padding], nil
}
