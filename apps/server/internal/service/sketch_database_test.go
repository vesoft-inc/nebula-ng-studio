package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
)

func TestSketchServiceReturnsControlledErrorWhenDatabaseDisabled(t *testing.T) {
	service := NewSketchService(context.Background(), svc.NewServiceContext(config.Config{}, nil))

	result, err := service.CreateSketch(&types.CreateSketchRequest{Name: "sketch"})

	require.Error(t, err)
	require.Nil(t, result)
	require.Contains(t, err.Error(), "studio database is disabled")
}
