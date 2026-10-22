package explorer

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type sequenceGenerator struct {
	next int
}

func (g *sequenceGenerator) Generate() string {
	g.next++
	return fmt.Sprintf("test-id-%d", g.next)
}

func newExplorerServiceContext(t *testing.T) *svc.ServiceContext {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	database, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.ApplySchemaMigrations(database))

	serviceContext := svc.NewServiceContext(config.Config{}, database)
	serviceContext.IDGenerator = &sequenceGenerator{}
	t.Cleanup(func() {
		sqlDB, sqlErr := database.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return serviceContext
}

func contextWithUser(username string) context.Context {
	return context.WithValue(context.Background(), auth.CtxKeyUserInfo{}, &auth.AuthData{
		Address:  "127.0.0.1:9669",
		Username: username,
	})
}

func countDatabaseQueries(t *testing.T, database *gorm.DB) *atomic.Int32 {
	t.Helper()
	var count atomic.Int32
	require.NoError(t, database.Callback().Query().Before("gorm:query").Register(
		"test:count_database_queries",
		func(*gorm.DB) {
			count.Add(1)
		},
	))
	return &count
}

func requireErrParam(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	codeErr, ok := ecode.AsCodeError(err)
	require.True(t, ok, "expected a coded error, got %v", err)
	require.Equal(t, ecode.CCBadRequest, codeErr.GetCategoryCode())
}
