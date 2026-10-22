package auth

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/oauth2auth"
)

const (
	testJWTIssuer            = "tenant-auth-issuer"
	testJWTTokenSecret       = "jwt-test-signing-secret-do-not-expose"
	testJWTEncryptPassphrase = "0123456789abcdef"
)

func TestRefreshOAuth2TokenAllowsValidAccessTokenWithoutRefreshToken(t *testing.T) {
	cfg := &config.Config{}
	cfg.SSO.Oauth2.Enable = true

	refreshed, err := RefreshOAuth2TokenIfNeeded(cfg, &AuthData{OAuth2SessionID: "session-1"}, &oauth2auth.TokenSession{
		AccessToken: "access",
		Expiry:      time.Now().Add(10 * time.Minute).Unix(),
	})

	require.NoError(t, err)
	require.False(t, refreshed)
}

func TestRefreshOAuth2TokenRejectsExpiredAccessTokenWithoutRefreshToken(t *testing.T) {
	cfg := &config.Config{}
	cfg.SSO.Oauth2.Enable = true

	refreshed, err := RefreshOAuth2TokenIfNeeded(cfg, &AuthData{OAuth2SessionID: "session-1"}, &oauth2auth.TokenSession{
		AccessToken: "access",
		Expiry:      time.Now().Add(-time.Minute).Unix(),
	})

	require.Error(t, err)
	require.False(t, refreshed)
	require.Contains(t, err.Error(), "token expired and refresh token is unavailable")
}

func TestRefreshOAuth2TokenRefreshesInsideMinTTL(t *testing.T) {
	var refreshCalls int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "refresh_token", r.Form.Get("grant_type"))
		require.Equal(t, "refresh-current", r.Form.Get("refresh_token"))
		atomic.AddInt32(&refreshCalls, 1)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"access_token":  "access-refreshed",
			"refresh_token": "refresh-refreshed",
			"expires_in":    3600,
			"token_type":    "Bearer",
		}))
	}))
	defer tokenServer.Close()

	cfg := testOAuth2RefreshConfig(tokenServer.URL)
	sessionID := "studio-oauth2-min-ttl"
	oauth2auth.GetTokenSessionStore().Set(sessionID, &oauth2auth.TokenSession{
		AccessToken:  "access-current",
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(30 * time.Second).Unix(),
		ServerName:   "casdoor",
	})
	t.Cleanup(func() { oauth2auth.GetTokenSessionStore().Delete(sessionID) })

	authData := &AuthData{OAuth2SessionID: sessionID}
	session, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
	require.True(t, ok)
	refreshed, err := RefreshOAuth2TokenIfNeeded(&cfg, authData, session)

	require.NoError(t, err)
	require.True(t, refreshed)
	require.Equal(t, "access-refreshed", authData.Token)
	require.Equal(t, int32(1), atomic.LoadInt32(&refreshCalls))
	stored, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
	require.True(t, ok)
	require.Equal(t, "access-refreshed", stored.AccessToken)
	require.Equal(t, "refresh-refreshed", stored.RefreshToken)
}

func TestRefreshOAuth2TokenRefreshesWhenAccessTokenIsEmpty(t *testing.T) {
	var refreshCalls int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "refresh-current", r.Form.Get("refresh_token"))
		atomic.AddInt32(&refreshCalls, 1)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"access_token":  "access-refreshed",
			"refresh_token": "refresh-current",
			"expires_in":    3600,
			"token_type":    "Bearer",
		}))
	}))
	defer tokenServer.Close()

	cfg := testOAuth2RefreshConfig(tokenServer.URL)
	sessionID := "studio-oauth2-empty-access-token"
	oauth2auth.GetTokenSessionStore().Set(sessionID, &oauth2auth.TokenSession{
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(time.Hour).Unix(),
		ServerName:   "casdoor",
	})
	t.Cleanup(func() { oauth2auth.GetTokenSessionStore().Delete(sessionID) })

	authData := &AuthData{OAuth2SessionID: sessionID}
	session, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
	require.True(t, ok)
	refreshed, err := RefreshOAuth2TokenIfNeeded(&cfg, authData, session)

	require.NoError(t, err)
	require.True(t, refreshed)
	require.Equal(t, "access-refreshed", authData.Token)
	require.Equal(t, int32(1), atomic.LoadInt32(&refreshCalls))
}

func TestRefreshOAuth2TokenReportsRefreshTokenOnlySessionChange(t *testing.T) {
	var refreshCalls int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "refresh-current", r.Form.Get("refresh_token"))
		atomic.AddInt32(&refreshCalls, 1)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"access_token":  "access-current",
			"refresh_token": "refresh-rotated",
			"expires_in":    3600,
			"token_type":    "Bearer",
		}))
	}))
	defer tokenServer.Close()

	cfg := testOAuth2RefreshConfig(tokenServer.URL)
	sessionID := "studio-oauth2-refresh-token-only"
	oauth2auth.GetTokenSessionStore().Set(sessionID, &oauth2auth.TokenSession{
		AccessToken:  "access-current",
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(30 * time.Second).Unix(),
		ServerName:   "casdoor",
	})
	t.Cleanup(func() { oauth2auth.GetTokenSessionStore().Delete(sessionID) })

	authData := &AuthData{OAuth2SessionID: sessionID}
	session, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
	require.True(t, ok)
	refreshed, err := RefreshOAuth2TokenIfNeeded(&cfg, authData, session)

	require.NoError(t, err)
	require.True(t, refreshed)
	require.Equal(t, int32(1), atomic.LoadInt32(&refreshCalls))
	stored, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
	require.True(t, ok)
	require.Equal(t, "access-current", stored.AccessToken)
	require.Equal(t, "refresh-rotated", stored.RefreshToken)
}

func TestSetRefreshedOAuth2AuthCookieClearsAccessToken(t *testing.T) {
	cfg := testOAuth2RefreshConfig("https://idp.example.test/token")
	cfg.Auth.TokenName = "studio_token"
	cfg.Auth.TokenIssuer = testJWTIssuer
	cfg.Auth.TokenSecret = "login-secret"
	cfg.Auth.EncryptPassphrase = "0123456789abcdef"
	cfg.Auth.TokenMaxAge = int64(time.Hour.Seconds())
	recorder := httptest.NewRecorder()

	err := setRefreshedOAuth2AuthCookie(recorder, cfg, &AuthData{
		Address:          "127.0.0.1:9669",
		Username:         "alice",
		ClientID:         "client-1",
		Token:            "access-refreshed",
		OAuth2SessionID:  "oauth2-session",
		OAuth2ServerName: "casdoor",
	})

	require.NoError(t, err)
	cookies := recorder.Result().Cookies()
	require.Len(t, cookies, 1)
	require.Equal(t, cfg.Auth.TokenName, cookies[0].Name)
	decoded, err := Decode(cookies[0].Value, cfg.Auth)
	require.NoError(t, err)
	require.Equal(t, "alice", decoded.Username)
	require.Equal(t, "client-1", decoded.ClientID)
	require.Equal(t, "oauth2-session", decoded.OAuth2SessionID)
	require.Empty(t, decoded.Token)
}

func TestStudioSharedPublicAndProtectedRoutes(t *testing.T) {
	publicRoutes := []string{
		"/api-studio/health",
		"/api-studio/health/ready",
		"/api-studio/db/connect",
		"/api-studio/db/oauth2-config",
		"/api-studio/db/oauth2-connect",
		"/api-studio/db/oauth2-callback",
	}
	for _, route := range publicRoutes {
		require.Truef(t, isNoAPIAuthRoute(route), "expected public route %s", route)
	}

	protectedRoutes := []string{
		"/api-studio/db/disconnect",
		"/api-studio/gql/exec",
		"/api-studio/nebula/userInfo",
		"/api-studio/nebula/changeSchema",
		"/api-studio/nebula/import-data",
		"/api-studio/nebula/console/execGql",
		"/api-studio/explorer/snapshots",
		"/api-studio/explorer/icongroup",
		"/api-studio/explorer/global-config",
	}
	for _, route := range protectedRoutes {
		require.Falsef(t, isNoAPIAuthRoute(route), "expected protected route %s", route)
	}
}

func TestUnconfiguredCookieIsRejected(t *testing.T) {
	cfg := config.Config{}
	cfg.Auth.TokenName = "studio_token"
	req := httptest.NewRequest(http.MethodGet, "/api-studio/explorer/snapshots", nil)
	req.AddCookie(&http.Cookie{Name: "other_token", Value: "untrusted-token"})
	recorder := httptest.NewRecorder()
	nextCalled := false

	handler := AuthMiddlewareWithCtx(svc.NewServiceContext(cfg, nil))(func(http.ResponseWriter, *http.Request) {
		nextCalled = true
	})
	handler(recorder, req)

	require.False(t, nextCalled)
}

func TestCreateTokenDoesNotExposeSigningSecret(t *testing.T) {
	cfg := testJWTConfig()
	authData := testJWTAuthData()

	tokenString, err := CreateToken(authData, &cfg)
	require.NoError(t, err)

	tokenParts := strings.Split(tokenString, ".")
	require.Len(t, tokenParts, 3)
	payloadJSON, err := base64.RawURLEncoding.DecodeString(tokenParts[1])
	require.NoError(t, err)
	payload := string(payloadJSON)
	require.NotContains(t, payload, testJWTTokenSecret)
	require.NotContains(t, tokenString, testJWTTokenSecret)

	var claims struct {
		Issuer string `json:"iss"`
	}
	require.NoError(t, json.Unmarshal(payloadJSON, &claims))
	require.Equal(t, testJWTIssuer, claims.Issuer)

	decoded, err := Decode(tokenString, cfg.Auth)
	require.NoError(t, err)
	require.Equal(t, authData, decoded)
}

func TestCreateTokenUsesNeutralDefaultIssuer(t *testing.T) {
	cfg := testJWTConfig()
	cfg.Auth.TokenIssuer = ""

	tokenString, err := CreateToken(testJWTAuthData(), &cfg)
	require.NoError(t, err)

	tokenParts := strings.Split(tokenString, ".")
	require.Len(t, tokenParts, 3)
	payloadJSON, err := base64.RawURLEncoding.DecodeString(tokenParts[1])
	require.NoError(t, err)

	var claims struct {
		Issuer string `json:"iss"`
	}
	require.NoError(t, json.Unmarshal(payloadJSON, &claims))
	require.Equal(t, "auth-service", claims.Issuer)
	require.NotContains(t, strings.ToLower(claims.Issuer), "nebula")
	require.NotContains(t, strings.ToLower(claims.Issuer), "studio")

	_, err = Decode(tokenString, cfg.Auth)
	require.NoError(t, err)
}

func TestDecodeRejectsInvalidJWT(t *testing.T) {
	validExpiry := time.Now().Add(time.Hour)
	tests := []struct {
		name             string
		token            func(t *testing.T) string
		expectedErrorSub string
	}{
		{
			name: "wrong issuer",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, "another-service", validExpiry)
				return signTestJWT(t, claims, jwt.SigningMethodHS256, []byte(testJWTTokenSecret))
			},
			expectedErrorSub: "token has invalid issuer",
		},
		{
			name: "legacy issuer exposes signing secret",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, testJWTTokenSecret, validExpiry)
				return signTestJWT(t, claims, jwt.SigningMethodHS256, []byte(testJWTTokenSecret))
			},
			expectedErrorSub: "token has invalid issuer",
		},
		{
			name: "missing issuer",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, "", validExpiry)
				return signTestJWT(t, claims, jwt.SigningMethodHS256, []byte(testJWTTokenSecret))
			},
			expectedErrorSub: "token has invalid issuer",
		},
		{
			name: "wrong signing key",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, testJWTIssuer, validExpiry)
				return signTestJWT(t, claims, jwt.SigningMethodHS256, []byte("wrong-test-signing-key"))
			},
			expectedErrorSub: "signature",
		},
		{
			name: "non-HS256 algorithm",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, testJWTIssuer, validExpiry)
				return signTestJWT(t, claims, jwt.SigningMethodHS512, []byte(testJWTTokenSecret))
			},
			expectedErrorSub: "signing method",
		},
		{
			name: "unsigned algorithm",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, testJWTIssuer, validExpiry)
				return signTestJWT(t, claims, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType)
			},
			expectedErrorSub: "signing method",
		},
		{
			name: "expired token",
			token: func(t *testing.T) string {
				claims := newTestAuthClaims(t, testJWTIssuer, time.Now().Add(-time.Minute))
				return signTestJWT(t, claims, jwt.SigningMethodHS256, []byte(testJWTTokenSecret))
			},
			expectedErrorSub: "token is expired",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Decode(tt.token(t), config.Auth{
				TokenIssuer:       testJWTIssuer,
				TokenSecret:       testJWTTokenSecret,
				EncryptPassphrase: testJWTEncryptPassphrase,
			})
			require.Error(t, err)
			require.ErrorContains(t, err, tt.expectedErrorSub)
		})
	}
}

func TestDecodeRejectsTamperedToken(t *testing.T) {
	cfg := testJWTConfig()
	tokenString, err := CreateToken(testJWTAuthData(), &cfg)
	require.NoError(t, err)

	tokenParts := strings.Split(tokenString, ".")
	require.Len(t, tokenParts, 3)
	payloadJSON, err := base64.RawURLEncoding.DecodeString(tokenParts[1])
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(payloadJSON, &payload))
	payload["exp"] = time.Now().Add(2 * time.Hour).Unix()
	tamperedPayload, err := json.Marshal(payload)
	require.NoError(t, err)
	tokenParts[1] = base64.RawURLEncoding.EncodeToString(tamperedPayload)
	tamperedToken := strings.Join(tokenParts, ".")

	_, err = Decode(tamperedToken, cfg.Auth)
	require.Error(t, err)
	require.ErrorContains(t, err, "signature")
}

func TestRefreshOAuth2TokenDeduplicatesConcurrentRefreshes(t *testing.T) {
	var refreshCalls int32
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		require.Equal(t, "refresh-current", r.Form.Get("refresh_token"))
		atomic.AddInt32(&refreshCalls, 1)
		time.Sleep(50 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(map[string]any{
			"access_token":  "access-refreshed",
			"refresh_token": "refresh-refreshed",
			"expires_in":    3600,
			"token_type":    "Bearer",
		}))
	}))
	defer tokenServer.Close()

	cfg := testOAuth2RefreshConfig(tokenServer.URL)
	sessionIDs := []string{"studio-oauth2-concurrent-a", "studio-oauth2-concurrent-b"}
	for _, sessionID := range sessionIDs {
		oauth2auth.GetTokenSessionStore().Set(sessionID, &oauth2auth.TokenSession{
			AccessToken:  "access-current",
			RefreshToken: "refresh-current",
			Expiry:       time.Now().Add(10 * time.Second).Unix(),
			ServerName:   "casdoor",
		})
		sessionID := sessionID
		t.Cleanup(func() { oauth2auth.GetTokenSessionStore().Delete(sessionID) })
	}

	var wg sync.WaitGroup
	errs := make(chan error, len(sessionIDs))
	for _, sessionID := range sessionIDs {
		sessionID := sessionID
		wg.Add(1)
		go func() {
			defer wg.Done()
			session, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
			if !ok {
				errs <- errMissingOAuth2Session{}
				return
			}
			refreshed, err := RefreshOAuth2TokenIfNeeded(&cfg, &AuthData{OAuth2SessionID: sessionID}, session)
			if err != nil {
				errs <- err
				return
			}
			if !refreshed {
				errs <- errRefreshNotReported{}
			}
		}()
	}
	wg.Wait()
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	require.Equal(t, int32(1), atomic.LoadInt32(&refreshCalls))
	for _, sessionID := range sessionIDs {
		stored, ok := oauth2auth.GetTokenSessionStore().Get(sessionID)
		require.True(t, ok)
		require.Equal(t, "access-refreshed", stored.AccessToken)
		require.Equal(t, "refresh-refreshed", stored.RefreshToken)
	}
}

func testJWTConfig() config.Config {
	cfg := config.Config{}
	cfg.Auth.TokenIssuer = testJWTIssuer
	cfg.Auth.TokenSecret = testJWTTokenSecret
	cfg.Auth.EncryptPassphrase = testJWTEncryptPassphrase
	cfg.Auth.TokenMaxAge = int64(time.Hour.Seconds())
	return cfg
}

func testJWTAuthData() *AuthData {
	return &AuthData{
		Address:          "127.0.0.1:9669",
		Username:         "alice",
		Password:         "synthetic-password",
		ClientID:         "client-1",
		CoreVersion:      "3.8.0",
		Version:          "test",
		Token:            "",
		OAuth2SessionID:  "oauth2-session",
		OAuth2ServerName: "test-idp",
	}
}

func newTestAuthClaims(t *testing.T, issuer string, expiry time.Time) authClaims {
	t.Helper()
	authDataJSON, err := json.Marshal(testJWTAuthData())
	require.NoError(t, err)
	encryptedAuthData, err := Encrypt(authDataJSON, testJWTEncryptPassphrase)
	require.NoError(t, err)
	return authClaims{
		EncryptedAuthData: encryptedAuthData,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			ExpiresAt: &jwt.NumericDate{Time: expiry},
		},
	}
}

func signTestJWT(t *testing.T, claims authClaims, method jwt.SigningMethod, key interface{}) string {
	t.Helper()
	tokenString, err := jwt.NewWithClaims(method, claims).SignedString(key)
	require.NoError(t, err)
	return tokenString
}

func testOAuth2RefreshConfig(tokenURL string) config.Config {
	cfg := config.Config{}
	cfg.SSO.Oauth2.Enable = true
	cfg.SSO.Oauth2.AccessTokenURL = tokenURL
	cfg.SSO.Oauth2.AuthURL = "https://idp.example.test/auth"
	cfg.SSO.Oauth2.ClientID = "client-id"
	cfg.SSO.Oauth2.ClientSecret = "client-secret"
	return cfg
}

type errMissingOAuth2Session struct{}

func (errMissingOAuth2Session) Error() string {
	return "oauth2 session missing"
}

type errRefreshNotReported struct{}

func (errRefreshNotReported) Error() string {
	return "refresh was not reported"
}
