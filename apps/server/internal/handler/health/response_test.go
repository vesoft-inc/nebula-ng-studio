package health_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/handler"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/zeromicro/go-zero/rest"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestHealthRoutes(t *testing.T) {
	tests := []struct {
		name          string
		method        string
		path          string
		configure     func(*testing.T, *config.Config) *gorm.DB
		wantStatus    int
		wantBody      string
		wantBodyBytes int64
	}{
		{
			name:       "liveness get",
			method:     http.MethodGet,
			path:       "/api-studio/health",
			wantStatus: http.StatusOK,
			wantBody:   `{"status":"ok"}`,
		},
		{
			name:          "liveness head",
			method:        http.MethodHead,
			path:          "/api-studio/health",
			wantStatus:    http.StatusOK,
			wantBodyBytes: int64(len(`{"status":"ok"}`)),
		},
		{
			name:       "unsupported method",
			method:     http.MethodPost,
			path:       "/api-studio/health",
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:   "database ready",
			method: http.MethodGet,
			path:   "/api-studio/health/ready",
			configure: func(t *testing.T, cfg *config.Config) *gorm.DB {
				cfg.Database.Enable = true
				database := openHealthTestDatabase(t, "ready")
				require.NoError(t, db.ApplySchemaMigrations(database))
				return database
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"database":"ok"}`,
		},
		{
			name:   "readiness head",
			method: http.MethodHead,
			path:   "/api-studio/health/ready",
			configure: func(t *testing.T, cfg *config.Config) *gorm.DB {
				cfg.Database.Enable = true
				database := openHealthTestDatabase(t, "ready-head")
				require.NoError(t, db.ApplySchemaMigrations(database))
				return database
			},
			wantStatus:    http.StatusOK,
			wantBodyBytes: int64(len(`{"database":"ok"}`)),
		},
		{
			name:   "database disabled",
			method: http.MethodGet,
			path:   "/api-studio/health/ready",
			configure: func(_ *testing.T, cfg *config.Config) *gorm.DB {
				cfg.Database.Enable = false
				return nil
			},
			wantStatus: http.StatusOK,
			wantBody:   `{"database":"disabled"}`,
		},
		{
			name:   "database unavailable",
			method: http.MethodGet,
			path:   "/api-studio/health/ready",
			configure: func(_ *testing.T, cfg *config.Config) *gorm.DB {
				cfg.Database.Enable = true
				return nil
			},
			wantStatus: http.StatusServiceUnavailable,
			wantBody:   `{"database":"unavailable"}`,
		},
		{
			name:   "database unmigrated",
			method: http.MethodGet,
			path:   "/api-studio/health/ready",
			configure: func(t *testing.T, cfg *config.Config) *gorm.DB {
				cfg.Database.Enable = true
				return openHealthTestDatabase(t, "unmigrated")
			},
			wantStatus: http.StatusServiceUnavailable,
			wantBody:   `{"database":"unavailable"}`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := healthTestConfig()
			var database *gorm.DB
			if test.configure != nil {
				database = test.configure(t, &cfg)
			}
			server := newHealthTestServer(t, cfg, database)
			request := httptest.NewRequest(test.method, test.path, nil)
			response := httptest.NewRecorder()

			server.ServeHTTP(response, request)

			require.Equal(t, test.wantStatus, response.Code)
			if test.wantStatus != http.StatusMethodNotAllowed {
				require.Equal(t, "no-store", response.Header().Get("Cache-Control"))
				require.Equal(t, "application/json", response.Header().Get("Content-Type"))
			}
			require.Equal(t, test.wantBody, response.Body.String())
			if test.wantBodyBytes > 0 {
				require.Equal(t, test.wantBodyBytes, response.Result().ContentLength)
			}
		})
	}
}

func newHealthTestServer(t *testing.T, cfg config.Config, database *gorm.DB) *rest.Server {
	t.Helper()
	serviceContext := svc.NewServiceContext(cfg, database)
	server, err := rest.NewServer(cfg.RestConf)
	require.NoError(t, err)
	server.Use(auth.AuthMiddlewareWithCtx(serviceContext))
	handler.RegisterHandlers(server, serviceContext)
	return server
}

func healthTestConfig() config.Config {
	cfg := config.Config{}
	cfg.Name = "studio-health-test"
	cfg.Host = "127.0.0.1"
	cfg.Port = 17001
	cfg.Timeout = 1000
	cfg.Auth.TokenName = "studio_token"
	return cfg
}

func openHealthTestDatabase(t *testing.T, name string) *gorm.DB {
	t.Helper()
	database, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return database
}
