package studio

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/handler"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/plugin"
	pluginauth "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/plugin/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version"
	"github.com/zeromicro/go-zero/rest"
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

func TestPluginSessionUsesExistingStudioFormatAndRegisteredClient(t *testing.T) {
	password, emptyPassword, graphdToken := "password", "", "database-access-token"
	for _, test := range []struct {
		name        string
		credentials pluginauth.Credentials
	}{
		{"password", pluginauth.Credentials{Password: &password}},
		{"empty password", pluginauth.Credentials{Password: &emptyPassword}},
		{"token", pluginauth.Credentials{GraphdToken: &graphdToken}},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg, params, deps, clients := pluginSessionFixture(t, test.credentials)
			session, err := openPluginSession(context.Background(), &cfg, params, deps)
			require.NoError(t, err)
			decoded, err := auth.Decode(session.Token, cfg.Auth.TokenSecret, cfg.Auth.EncryptPassphrase)
			require.NoError(t, err)
			var expectedPassword, expectedToken string
			if test.credentials.Password != nil {
				expectedPassword = *test.credentials.Password
			} else {
				expectedToken = *test.credentials.GraphdToken
			}
			require.Equal(t, &auth.AuthData{
				Address: params.Address, Username: params.Username, Password: expectedPassword,
				ClientID: "extension-client", CoreVersion: "5.4.0", Version: version.Value, Token: expectedToken,
			}, decoded)
			client := clients.GetClient(decoded.ClientID)
			require.NotNil(t, client)
			require.Equal(t, params.DefaultSchema, client.CurSchemaPath)
			require.Nil(t, clients.GetClient("existing"))
			require.Equal(t, 1, clients.Len())
		})
	}
}

func TestPluginSessionValidatesParametersBeforeConnecting(t *testing.T) {
	password, token, empty := "password", "database-token", ""
	for _, test := range []struct {
		name    string
		mutate  func(*pluginauth.ConnectParams)
		message string
	}{
		{"address", func(p *pluginauth.ConnectParams) { p.Address = " " }, "address and username"},
		{"username", func(p *pluginauth.ConnectParams) { p.Username = "" }, "address and username"},
		{"missing credentials", func(p *pluginauth.ConnectParams) { p.Credentials = pluginauth.Credentials{} }, "exactly one"},
		{"ambiguous credentials", func(p *pluginauth.ConnectParams) {
			p.Credentials = pluginauth.Credentials{Password: &password, GraphdToken: &token}
		}, "exactly one"},
		{"empty password plus token", func(p *pluginauth.ConnectParams) {
			p.Credentials = pluginauth.Credentials{Password: &empty, GraphdToken: &token}
		}, "exactly one"},
		{"empty token", func(p *pluginauth.ConnectParams) { p.Credentials.GraphdToken = &empty }, "must not be empty"},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg, params, _, _ := pluginSessionFixture(t, pluginauth.Credentials{GraphdToken: &token})
			test.mutate(&params)
			// No dependencies: invalid input must fail before any Graphd operation.
			session, err := openPluginSession(context.Background(), &cfg, params, pluginSessionDependencies{})
			require.ErrorContains(t, err, test.message)
			require.Empty(t, session.Token)
		})
	}
	host := &pluginHost{svcCtx: &svc.ServiceContext{Config: config.Config{
		Auth: config.Auth{TokenName: "studio_token", TokenMaxAge: 3600},
	}}}
	require.Equal(t, pluginauth.CookieConfig{Name: "studio_token", MaxAge: 3600}, host.Auth().CookieConfig())
	_, err := host.Auth().OpenSession(context.Background(), pluginauth.ConnectParams{})
	require.ErrorContains(t, err, "address and username")
}

func TestPluginSessionFailurePreservesExistingClient(t *testing.T) {
	for _, failure := range []string{"probe", "connect", "nil client", "sign"} {
		t.Run(failure, func(t *testing.T) {
			token := "database-token"
			cfg, params, deps, clients := pluginSessionFixture(t, pluginauth.Credentials{GraphdToken: &token})
			expectedErr := errors.New(failure + " failed")
			switch failure {
			case "probe":
				deps.pingToken = func(string, string, string) (string, error) { return "", expectedErr }
				deps.newClient = nil
			case "connect":
				deps.newClient = func(string, string, string, string, string, int) (*nebula.Client, error) {
					return nil, expectedErr
				}
			case "nil client":
				deps.newClient = func(string, string, string, string, string, int) (*nebula.Client, error) {
					return nil, nil
				}
			case "sign":
				cfg.Auth.EncryptPassphrase = "invalid-key"
			}
			closed := 0
			deps.closeClient = func(client *nebula.Client) {
				require.Equal(t, "extension-client", client.ID)
				closed++
			}
			session, err := openPluginSession(context.Background(), &cfg, params, deps)
			require.Error(t, err)
			if failure == "probe" || failure == "connect" {
				require.ErrorIs(t, err, expectedErr)
			}
			require.Empty(t, session.Token)
			require.NotNil(t, clients.GetClient("existing"))
			require.Nil(t, clients.GetClient("extension-client"))
			require.Equal(t, 1, clients.Len())
			if failure == "sign" {
				require.Equal(t, 1, closed)
			} else {
				require.Zero(t, closed)
			}
		})
	}
}

func TestPluginSessionCancellationPreservesExistingClient(t *testing.T) {
	for _, stage := range []string{"before", "probe", "connect", "sign"} {
		t.Run(stage, func(t *testing.T) {
			token := "database-token"
			cfg, params, deps, clients := pluginSessionFixture(t, pluginauth.Credentials{GraphdToken: &token})
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			var calls []string
			reached := func(current string) {
				calls = append(calls, current)
				if stage == current {
					cancel()
				}
			}
			probe, connect, sign := deps.pingToken, deps.newClient, deps.createToken
			deps.pingToken = func(a, u, token string) (string, error) {
				reached("probe")
				return probe(a, u, token)
			}
			deps.newClient = func(a, u, p, token, schema string, timeout int) (*nebula.Client, error) {
				reached("connect")
				return connect(a, u, p, token, schema, timeout)
			}
			deps.createToken = func(data *auth.AuthData, cfg *config.Config) (string, error) {
				result, err := sign(data, cfg)
				reached("sign")
				return result, err
			}
			deps.closeClient = func(client *nebula.Client) {
				require.Equal(t, "extension-client", client.ID)
				reached("close")
			}
			if stage == "before" {
				cancel()
			}
			session, err := openPluginSession(ctx, &cfg, params, deps)
			require.ErrorIs(t, err, context.Canceled)
			require.Empty(t, session.Token)
			require.NotNil(t, clients.GetClient("existing"))
			require.Nil(t, clients.GetClient("extension-client"))
			require.Equal(t, 1, clients.Len())
			expected := map[string][]string{
				"before":  nil,
				"probe":   {"probe"},
				"connect": {"probe", "connect", "close"},
				"sign":    {"probe", "connect", "sign", "close"},
			}
			require.Equal(t, expected[stage], calls)
		})
	}
}

func pluginSessionFixture(t *testing.T, credentials pluginauth.Credentials) (config.Config, pluginauth.ConnectParams, pluginSessionDependencies, *nebula.ClientLRU) {
	t.Helper()
	cfg := config.Config{Auth: config.Auth{
		TokenName: "studio_token", TokenSecret: "plugin-token-test", EncryptPassphrase: "0123456789abcdef", TokenMaxAge: 3600,
	}}
	params := pluginauth.ConnectParams{
		Address: "graphd.example.test:9669", Username: "alice", DefaultSchema: "/sales", Credentials: credentials,
	}
	clients := nebula.NewClientLRU(1)
	clients.PutClient("existing", &nebula.Client{ID: "existing", LastExecuteTime: time.Now()})
	var password, token string
	if credentials.Password != nil {
		password = *credentials.Password
	}
	if credentials.GraphdToken != nil {
		token = *credentials.GraphdToken
	}
	deps := defaultPluginSessionDependencies()
	deps.pingPassword = func(a, u, p string) (string, error) {
		require.NotNil(t, credentials.Password, "token authentication must not use the password probe")
		require.Equal(t, []string{params.Address, params.Username, password}, []string{a, u, p})
		return "5.4.0", nil
	}
	deps.pingToken = func(a, u, value string) (string, error) {
		require.NotNil(t, credentials.GraphdToken, "password authentication must not use the token probe")
		require.Equal(t, []string{params.Address, params.Username, token}, []string{a, u, value})
		return "5.4.0", nil
	}
	deps.newClient = func(a, u, p, value, schema string, timeout int) (*nebula.Client, error) {
		require.Equal(t, []string{params.Address, params.Username, password, token, params.DefaultSchema}, []string{a, u, p, value, schema})
		require.Zero(t, timeout)
		return &nebula.Client{ID: "extension-client", LastExecuteTime: time.Now(), CurSchemaPath: schema}, nil
	}
	deps.storeClient = func(client *nebula.Client) { clients.PutClient(client.ID, client) }
	deps.closeClient = func(*nebula.Client) { t.Fatal("unexpected client close") }
	return cfg, params, deps, clients
}

func TestPluginRoutesRejectInvalidContributionsBeforeMounting(t *testing.T) {
	handle := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }
	for _, test := range []struct {
		name    string
		routes  []plugin.Route
		message string
	}{
		{"missing method", []plugin.Route{{Path: "/extra", Handler: handle}}, "not a valid http method"},
		{"unsupported method", []plugin.Route{{Method: "get", Path: "/extra", Handler: handle}}, "not a valid http method"},
		{"path", []plugin.Route{{Method: http.MethodGet, Path: "extra", Handler: handle}}, "path must begin"},
		{"handler", []plugin.Route{{Method: http.MethodGet, Path: "/extra"}}, "no handler"},
		{"public parameter", []plugin.Route{{Method: http.MethodGet, Path: "/extra/:id", Public: true, Handler: handle}}, "canonical literal path"},
		{"public trailing slash", []plugin.Route{{Method: http.MethodGet, Path: "/extra/", Public: true, Handler: handle}}, "canonical literal path"},
		{"public parent path", []plugin.Route{{Method: http.MethodGet, Path: "/extra/../login", Public: true, Handler: handle}}, "canonical literal path"},
		{"built-in collision", []plugin.Route{{Method: http.MethodPost, Path: "/api-studio/gql/exec", Public: true, Handler: handle}}, "duplicated item"},
		{"normalized built-in collision", []plugin.Route{{Method: http.MethodPost, Path: "/api-studio/gql//exec/", Handler: handle}}, "duplicated item"},
		{"built-in parameter collision", []plugin.Route{{Method: http.MethodGet, Path: "/api-studio/explorer/snapshots/:other", Handler: handle}}, "duplicated item"},
		{"private on public path", []plugin.Route{{Method: http.MethodPost, Path: "/api-studio/health", Handler: handle}}, "overlaps built-in public path"},
		{"private pattern on public path", []plugin.Route{{Method: http.MethodPost, Path: "/api-studio/:resource", Handler: handle}}, "overlaps built-in public path"},
		{"plugin collision", []plugin.Route{
			{Method: http.MethodGet, Path: "/extra/items", Handler: handle},
			{Method: http.MethodGet, Path: "/extra//items/", Handler: handle},
		}, "duplicated item"},
		{"plugin parameter collision", []plugin.Route{
			{Method: http.MethodGet, Path: "/extra/:id", Handler: handle},
			{Method: http.MethodGet, Path: "/extra/:name", Handler: handle},
		}, "duplicated item"},
	} {
		t.Run(test.name, func(t *testing.T) {
			cfg := config.Config{Auth: config.Auth{TokenName: "studio_token"}}
			server, err := rest.NewServer(cfg.RestConf)
			require.NoError(t, err)
			handler.RegisterHandlers(server, svc.NewServiceContext(cfg, nil))
			originalCount := len(server.Routes())
			// A valid earlier contribution must not be mounted if any later one fails.
			routes := append([]plugin.Route{{Method: http.MethodPost, Path: "/extra/login", Public: true, Handler: handle}}, test.routes...)
			public, err := registerPluginRoutes(server, routes)
			require.ErrorContains(t, err, test.message)
			require.Empty(t, public)
			require.Len(t, server.Routes(), originalCount)
		})
	}
}

func TestPluginRoutesUseExactPublicAccessAndSupportPrivateParameters(t *testing.T) {
	for _, test := range []struct {
		method string
		path   string
		status int
	}{
		{http.MethodPost, "/extra/login", http.StatusNoContent},
		{http.MethodGet, "/extra/login", http.StatusUnauthorized},
		{http.MethodPost, "/extra/login/", http.StatusUnauthorized},
		{http.MethodPost, "/extra//login", http.StatusUnauthorized},
		{http.MethodPost, "/extra/login/child", http.StatusUnauthorized},
		{http.MethodGet, "/extra/items/123", http.StatusUnauthorized},
		{http.MethodPost, "/api-studio/gql/exec", http.StatusUnauthorized},
	} {
		t.Run(test.method+test.path, func(t *testing.T) {
			cfg := config.Config{Auth: config.Auth{TokenName: "studio_token"}}
			svcCtx := svc.NewServiceContext(cfg, nil)
			server, err := rest.NewServer(cfg.RestConf)
			require.NoError(t, err)
			handler.RegisterHandlers(server, svcCtx)
			handle := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }
			public, err := registerPluginRoutes(server, []plugin.Route{
				{Method: http.MethodPost, Path: "/extra/login", Public: true, Handler: handle},
				{Method: http.MethodGet, Path: "/extra/login", Handler: handle},
				{Method: http.MethodPost, Path: "/extra/login/:child", Handler: handle},
				{Method: http.MethodGet, Path: "/extra/items/:id", Handler: handle},
			})
			require.NoError(t, err)
			require.Len(t, public, 1)
			require.Equal(t, rest.Route{Method: http.MethodPost, Path: "/extra/login"}, public[0])
			server.Use(auth.AuthMiddlewareWithCtx(svcCtx, public...))
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, nil))
			require.Equal(t, test.status, recorder.Code)
		})
	}
}

func TestRunUsesProvidedArgumentsWithoutRegisteringGlobalFlags(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()
	var before, after []*flag.Flag
	flag.CommandLine.VisitAll(func(f *flag.Flag) { before = append(before, f) })
	for range 2 {
		require.NoError(t, Run([]string{"-healthcheck", server.URL}))
	}
	flag.CommandLine.VisitAll(func(f *flag.Flag) { after = append(after, f) })
	require.Equal(t, before, after)
}

func TestRunReturnsArgumentAndConfigErrors(t *testing.T) {
	missingConfig := filepath.Join(t.TempDir(), "missing.yaml")
	for _, test := range []struct {
		name, message string
		args          []string
	}{
		{"unknown argument", "flag provided but not defined", []string{"-unknown"}},
		{"missing argument", "flag needs an argument", []string{"-f"}},
		{"missing config", "load config", []string{"-f", missingConfig}},
	} {
		t.Run(test.name, func(t *testing.T) {
			require.ErrorContains(t, Run(test.args), test.message)
		})
	}
	require.NoError(t, Run([]string{"-h"}))
	require.NoError(t, Run([]string{"-f", missingConfig, "-v"}))
}

func TestRunReturnsListenError(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer listener.Close()
	port := listener.Addr().(*net.TCPAddr).Port
	configPath := filepath.Join(t.TempDir(), "studio.yaml")
	cfg := fmt.Sprintf(`Name: test
Host: 127.0.0.1
Port: %d
Log: {Mode: console}
DevServer: {Enabled: false}
Assets: {Gzip: true}
Auth: {TokenName: studio_token, TokenMaxAge: 3600}
Database: {Enable: false, Dialect: mysql}
Nebula: {ClientMaxNum: 1}
`, port)
	require.NoError(t, os.WriteFile(configPath, []byte(cfg), 0600))
	require.ErrorIs(t, Run([]string{"-f", configPath}), syscall.EADDRINUSE)
}
