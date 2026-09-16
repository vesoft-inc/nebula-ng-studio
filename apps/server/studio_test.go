package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRunHealthcheck(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	if err := runHealthcheck(server.URL); err != nil {
		t.Fatalf("expected healthy endpoint: %v", err)
	}
}

func TestRunHealthcheckRejectsServerErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)

	if err := runHealthcheck(server.URL); err == nil {
		t.Fatal("expected unhealthy endpoint to return an error")
	}
}
