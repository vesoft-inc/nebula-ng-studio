package utils

import (
	"strings"
	"testing"
)

func TestSm4EncryptDecrypt(t *testing.T) {
	message := "Hello, this is a test message! 你好世界 123"

	encrypted, err := Sm4Encrypt([]byte(message), "")
	if err != nil {
		t.Fatalf("encrypt error: %v", err)
	}

	decrypted, err := Sm4Decrypt(encrypted, "")
	if err != nil {
		t.Fatalf("decrypt error: %v", err)
	}
	if string(decrypted) != message {
		t.Fatalf("round trip mismatch: got %q, want %q", decrypted, message)
	}
}

func TestSm4EncryptUsesRandomIV(t *testing.T) {
	message := `["username","password"]`

	first, err := Sm4Encrypt([]byte(message), "")
	if err != nil {
		t.Fatalf("encrypt first ciphertext: %v", err)
	}
	second, err := Sm4Encrypt([]byte(message), "")
	if err != nil {
		t.Fatalf("encrypt second ciphertext: %v", err)
	}
	if first == second {
		t.Fatal("expected a fresh IV for every ciphertext, got identical output")
	}
}

func TestSm4RejectsEmptyDataAndInvalidKeys(t *testing.T) {
	if _, err := Sm4Encrypt(nil, ""); err == nil || !strings.Contains(err.Error(), "data to encrypt cannot be empty") {
		t.Fatalf("expected empty data to be rejected, got %v", err)
	}
	if _, err := Sm4Encrypt([]byte("credentials"), "zz"); err == nil || !strings.Contains(err.Error(), "valid hex string") {
		t.Fatalf("expected a non-hex passphrase to be rejected, got %v", err)
	}
	if _, err := Sm4Encrypt([]byte("credentials"), "0123456789abcdef"); err == nil || !strings.Contains(err.Error(), "128-bit key") {
		t.Fatalf("expected a non-128-bit key to be rejected, got %v", err)
	}
	if _, err := Sm4Decrypt("", ""); err == nil || !strings.Contains(err.Error(), "encrypted data cannot be empty") {
		t.Fatalf("expected empty ciphertext to be rejected, got %v", err)
	}
}
