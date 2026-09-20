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

func TestRunHealthcheckRequiresExactOKStatus(t *testing.T) {
	for _, status := range []int{
		http.StatusNoContent,
		http.StatusBadRequest,
		http.StatusServiceUnavailable,
	} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
				response.WriteHeader(status)
			}))
			t.Cleanup(server.Close)

			if err := runHealthcheck(server.URL); err == nil {
				t.Fatalf("expected HTTP %d to be rejected", status)
			}
		})
	}
}

func TestRunHealthcheckDoesNotFollowRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/healthy" {
			response.WriteHeader(http.StatusOK)
			return
		}
		http.Redirect(response, request, "/healthy", http.StatusFound)
	}))
	t.Cleanup(server.Close)

	if err := runHealthcheck(server.URL); err == nil {
		t.Fatal("expected a redirect to be rejected")
	}
}
