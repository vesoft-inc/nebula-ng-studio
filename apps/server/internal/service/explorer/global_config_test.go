package explorer

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
)

func TestGlobalConfigServiceCRUDAndUpsert(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	service := NewGlobalConfigService(contextWithUser("alice"), serviceContext)

	created, err := service.Add(&types.AddGlobalConfigParams{Key: "appearance", Value: `{"theme":"dark"}`})
	require.NoError(t, err)
	require.Equal(t, "appearance", created.Key)

	detail, err := service.Detail(&types.GetGlobalConfigParams{Key: "appearance"})
	require.NoError(t, err)
	require.Equal(t, `{"theme":"dark"}`, detail.Value)
	require.NotZero(t, detail.UpdatedAt)

	list, err := service.List(&types.GetGlobalConfigsParams{Page: 1, PageSize: 10, Filter: `{"key":"appearance"}`})
	require.NoError(t, err)
	require.Equal(t, 1, list.Total)
	require.Len(t, list.Items, 1)

	updated, err := service.Update(&types.UpdateGlobalConfigParams{Key: "appearance", Value: `{"theme":"light"}`})
	require.NoError(t, err)
	require.Equal(t, "appearance", updated.Key)

	upserted, err := service.Upsert(&types.UpsertGlobalConfigParams{Key: "appearance", Value: `{"theme":"system"}`})
	require.NoError(t, err)
	require.Equal(t, "appearance", upserted.Key)

	detail, err = service.Detail(&types.GetGlobalConfigParams{Key: "appearance"})
	require.NoError(t, err)
	require.Equal(t, `{"theme":"system"}`, detail.Value)

	deleted, err := service.Delete(&types.DeleteGlobalConfigParams{Key: "appearance"})
	require.NoError(t, err)
	require.Equal(t, "appearance", deleted.Key)

	_, err = service.Detail(&types.GetGlobalConfigParams{Key: "appearance"})
	require.Error(t, err)
}

func TestGlobalConfigServiceValidatesErrors(t *testing.T) {
	service := NewGlobalConfigService(contextWithUser("alice"), newExplorerServiceContext(t))

	_, err := service.List(&types.GetGlobalConfigsParams{Page: 1, PageSize: 10, Filter: "not-json"})
	require.Error(t, err)
	_, err = service.Update(&types.UpdateGlobalConfigParams{Key: "missing"})
	require.Error(t, err)
	_, err = service.Delete(&types.DeleteGlobalConfigParams{Key: "missing"})
	require.Error(t, err)
}
