package svc

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestNewServiceContextUsesInjectedDatabase(t *testing.T) {
	database, err := gorm.Open(sqlite.Open("file:service-context?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	serviceContext := NewServiceContext(config.Config{}, database)

	require.Same(t, database, serviceContext.DB)
	require.NotNil(t, serviceContext.IDGenerator)
	require.NotNil(t, serviceContext.ResponseHandler)
}

func TestNewServiceContextAllowsDisabledDatabase(t *testing.T) {
	serviceContext := NewServiceContext(config.Config{}, nil)
	require.Nil(t, serviceContext.DB)
}
