package gateway_test

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/emmansun/gmsm/sm4"
	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	gatewayhandler "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/handler/gateway"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/zeromicro/go-zero/rest"
)

func TestConnectHandlerRejectsIVOnlyCiphertextWithoutRecovery(t *testing.T) {
	var recoveryCount atomic.Int32
	cfg := connectHandlerTestConfig()
	serviceContext := svc.NewServiceContext(cfg, nil)
	server, err := rest.NewServer(cfg.RestConf)
	require.NoError(t, err)

	server.Use(recoveryCounterMiddleware(&recoveryCount))
	server.Use(auth.AuthMiddlewareWithCtx(serviceContext))
	server.AddRoute(rest.Route{
		Method:  http.MethodPost,
		Path:    "/api-studio/db/connect",
		Handler: gatewayhandler.ConnectHandler(serviceContext),
	})

	ivOnly := base64.StdEncoding.EncodeToString(make([]byte, sm4.BlockSize))
	response := performConnectRequest(t, server, "sm4 "+ivOnly)

	require.Equal(t, http.StatusBadRequest, response.Code)
	body := response.Body.String()
	require.Contains(t, body, "ciphertext too short")
	require.NotContains(t, body, "panic")
	require.NotContains(t, body, "goroutine")
	require.NotContains(t, body, "connection refused")
	require.Equal(t, int32(0), recoveryCount.Load())

	response = performConnectRequest(t, server, "malformed-authorization")
	require.Equal(t, http.StatusBadRequest, response.Code)
	require.Contains(t, response.Body.String(), "invalid authorization")
	require.Equal(t, int32(0), recoveryCount.Load())
}

func connectHandlerTestConfig() config.Config {
	cfg := config.Config{}
	cfg.Name = "studio-connect-handler-test"
	cfg.Host = "127.0.0.1"
	cfg.Port = 17002
	cfg.Timeout = 1000
	cfg.Auth.TokenName = "studio_token"
	return cfg
}

func performConnectRequest(t *testing.T, server *rest.Server, authorization string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(
		http.MethodPost,
		"/api-studio/db/connect",
		strings.NewReader(`{"address":"127.0.0.1:1"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", authorization)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	return response
}

func recoveryCounterMiddleware(recoveryCount *atomic.Int32) rest.Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recover() != nil {
					recoveryCount.Add(1)
					http.Error(w, "internal server error", http.StatusInternalServerError)
				}
			}()
			next(w, r)
		}
	}
}
