package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/go-pkg/middleware"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/oauth2auth"
)

func TestConnectRequiresServerNameWhenEnabled(t *testing.T) {
	cfg := config.Config{}
	cfg.SSO.Oauth2.Enable = true
	cfg.SSO.Oauth2.AuthURL = "https://idp.example.test/auth"

	service := NewOauth2Service(context.Background(), &svc.ServiceContext{Config: cfg})
	_, err := service.Connect(&types.Oauth2ConnectReq{Address: "127.0.0.1:9669"})

	require.Error(t, err)
	require.Contains(t, err.Error(), "ServerName")
}

func TestOAuth2CallbackRedirectPathUsesBasePath(t *testing.T) {
	require.Equal(t, "/studio", oauth2CallbackRedirectPath(config.Config{BasePath: "/studio"}))
	require.Equal(t, "/", oauth2CallbackRedirectPath(config.Config{}))
}

func TestOAuth2AuthorizationCallbackAndDisconnect(t *testing.T) {
	var tokenRequest url.Values
	var userInfoAuthorization string
	idp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			if err := r.ParseForm(); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			tokenRequest = r.Form
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token":  "access-from-idp",
				"refresh_token": "refresh-from-idp",
				"expires_in":    3600,
				"token_type":    "Bearer",
			})
		case "/userinfo":
			userInfoAuthorization = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"preferred_username": "alice"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer idp.Close()

	cfg := config.Config{}
	cfg.Auth.TokenName = "studio_token"
	cfg.Auth.TokenSecret = "studio-oauth2-test-secret"
	cfg.Auth.EncryptPassphrase = "0123456789abcdef"
	cfg.Auth.TokenMaxAge = int64(time.Hour.Seconds())
	cfg.Nebula.ClientMaxNum = 10
	cfg.SSO.Oauth2.Enable = true
	cfg.SSO.Oauth2.ServerName = "test-idp"
	cfg.SSO.Oauth2.AuthURL = idp.URL + "/authorize"
	cfg.SSO.Oauth2.AccessTokenURL = idp.URL + "/token"
	cfg.SSO.Oauth2.ClientID = "studio-client"
	cfg.SSO.Oauth2.RedirectURL = "http://studio.example.test/api-studio/db/oauth2-callback"
	cfg.SSO.Oauth2.UserInfoURL = idp.URL + "/userinfo"
	cfg.SSO.Oauth2.Scope = "openid profile"
	cfg.SSO.Oauth2.UsernameField = "preferred_username"
	require.NoError(t, cfg.InitConfig())
	nebula.InitClientContainer()

	var storedClient *nebula.Client
	dependencies := oauth2Dependencies{
		pingGraphd: func(address, username, token, serverName string) (string, error) {
			require.Equal(t, "graphd.example.test:9669", address)
			require.Equal(t, "alice", username)
			require.Equal(t, "access-from-idp", token)
			require.Equal(t, "test-idp", serverName)
			return "5.2.0", nil
		},
		newClient: func(address, username, token, serverName, schemaPath string, timeoutSeconds int) (*nebula.Client, error) {
			require.Equal(t, "graphd.example.test:9669", address)
			require.Equal(t, "alice", username)
			require.Equal(t, "access-from-idp", token)
			require.Equal(t, "test-idp", serverName)
			require.Empty(t, schemaPath)
			require.Zero(t, timeoutSeconds)
			return &nebula.Client{ID: "oauth2-client-test"}, nil
		},
		storeClient: func(client *nebula.Client) {
			storedClient = client
		},
	}

	serviceContext := &svc.ServiceContext{Config: cfg}
	connectRequest := httptest.NewRequest(http.MethodPost, "http://studio.example.test/api-studio/db/oauth2-connect", nil)
	var connectResponse *types.Oauth2ConnectResp
	var connectError error
	connectRecorder := runWithReservedHTTPContext(connectRequest, func(ctx context.Context) {
		connectResponse, connectError = newOauth2Service(ctx, serviceContext, dependencies).Connect(&types.Oauth2ConnectReq{
			Address: "graphd.example.test:9669",
		})
	})
	require.NoError(t, connectError)
	require.NotNil(t, connectResponse)

	authorizationURL, err := url.Parse(connectResponse.AuthURL)
	require.NoError(t, err)
	require.Equal(t, idp.URL+"/authorize", authorizationURL.Scheme+"://"+authorizationURL.Host+authorizationURL.Path)
	state := authorizationURL.Query().Get("state")
	require.NotEmpty(t, state)
	require.Equal(t, "S256", authorizationURL.Query().Get("code_challenge_method"))
	require.NotEmpty(t, authorizationURL.Query().Get("code_challenge"))
	flowCookie := findResponseCookie(t, connectRecorder, oauth2auth.FlowCookieName)
	require.True(t, flowCookie.HttpOnly)

	callbackRequest := httptest.NewRequest(
		http.MethodGet,
		"http://studio.example.test/api-studio/db/oauth2-callback?code=authorization-code&state="+url.QueryEscape(state),
		nil,
	)
	callbackRequest.AddCookie(flowCookie)
	var callbackError error
	callbackRecorder := runWithReservedHTTPContext(callbackRequest, func(ctx context.Context) {
		ctx = context.WithValue(ctx, "oauth2_cookie", flowCookie.Value)
		callbackError = newOauth2Service(ctx, serviceContext, dependencies).Callback(&types.Oauth2CallbackReq{
			Code:  "authorization-code",
			State: state,
		})
	})
	require.NoError(t, callbackError)
	require.Equal(t, http.StatusFound, callbackRecorder.Code)
	require.Equal(t, "/", callbackRecorder.Header().Get("Location"))
	require.NotNil(t, storedClient)
	require.Equal(t, "oauth2-client-test", storedClient.ID)
	require.Equal(t, "authorization_code", tokenRequest.Get("grant_type"))
	require.Equal(t, "authorization-code", tokenRequest.Get("code"))
	require.NotEmpty(t, tokenRequest.Get("code_verifier"))
	require.Equal(t, "Bearer access-from-idp", userInfoAuthorization)

	authCookie := findResponseCookie(t, callbackRecorder, cfg.Auth.TokenName)
	authData, err := auth.Decode(authCookie.Value, cfg.Auth.TokenSecret, cfg.Auth.EncryptPassphrase)
	require.NoError(t, err)
	require.Equal(t, "alice", authData.Username)
	require.Equal(t, "graphd.example.test:9669", authData.Address)
	require.Equal(t, "oauth2-client-test", authData.ClientID)
	require.Equal(t, "test-idp", authData.OAuth2ServerName)
	require.Empty(t, authData.Token, "the OAuth2 access token must not be stored in the browser cookie")
	require.NotEmpty(t, authData.OAuth2SessionID)
	tokenSession, ok := oauth2auth.GetTokenSessionStore().Get(authData.OAuth2SessionID)
	require.True(t, ok)
	require.Equal(t, "access-from-idp", tokenSession.AccessToken)
	require.Equal(t, "refresh-from-idp", tokenSession.RefreshToken)

	disconnectRequest := httptest.NewRequest(http.MethodPost, "http://studio.example.test/api-studio/db/disconnect", nil)
	var disconnectError error
	disconnectRecorder := runWithReservedHTTPContext(disconnectRequest, func(ctx context.Context) {
		ctx = context.WithValue(ctx, auth.CtxKeyUserInfo{}, authData)
		_, disconnectError = NewGatewayService(ctx, serviceContext).Disconnect()
	})
	require.NoError(t, disconnectError)
	_, ok = oauth2auth.GetTokenSessionStore().Get(authData.OAuth2SessionID)
	require.False(t, ok, "disconnect must remove the server-side OAuth2 token session")
	disabledAuthCookie := findResponseCookie(t, disconnectRecorder, cfg.Auth.TokenName)
	require.Less(t, disabledAuthCookie.MaxAge, 0)
}

func runWithReservedHTTPContext(request *http.Request, run func(context.Context)) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	handler := middleware.ReserveRequest(middleware.ReserveRequestConfig{
		Skipper: func(*http.Request) bool { return false },
	})(middleware.ReserveResponseWriter(middleware.ReserveResponseWriterConfig{
		Skipper: func(*http.Request) bool { return false },
	})(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		run(request.Context())
	})))
	handler.ServeHTTP(recorder, request)
	return recorder
}

func findResponseCookie(t *testing.T, recorder *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("response cookie %q not found", name)
	return nil
}
