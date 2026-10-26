package explorer

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
)

func TestSnapshotServiceCRUDAndOwnership(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	alice := NewSnapshotService(contextWithUser("alice"), serviceContext)
	bob := NewSnapshotService(contextWithUser("bob"), serviceContext)

	created, err := alice.Add(&types.AddSnapshotParams{
		Name:       "first snapshot",
		Graph:      "demo",
		GraphType:  "demo_type",
		SchemaPath: "/schema/demo",
		Data:       `{"nodes":[]}`,
		Thumbnail:  "thumbnail",
	})
	require.NoError(t, err)
	require.Equal(t, "test-id-1", created.ID)

	list, err := alice.List(&types.GetSnapshotsParams{Page: 1, PageSize: 10, Filter: `{"name":"first"}`})
	require.NoError(t, err)
	require.Equal(t, 1, list.Total)
	require.Len(t, list.Items, 1)
	require.Equal(t, "demo_type", list.Items[0].GraphType)
	require.Equal(t, "/schema/demo", list.Items[0].SchemaPath)

	detail, err := alice.Detail(&types.GetSnapshotDetailParams{ID: created.ID})
	require.NoError(t, err)
	require.Equal(t, `{"nodes":[]}`, detail.Data)
	require.Equal(t, "thumbnail", detail.Thumbnail)
	require.Equal(t, "/schema/demo", detail.SchemaPath)
	encoded, err := json.Marshal(detail)
	require.NoError(t, err)
	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(encoded, &payload))
	require.Equal(t, "/schema/demo", payload["schemaPath"])

	_, err = bob.Detail(&types.GetSnapshotDetailParams{ID: created.ID})
	require.Error(t, err)
	_, err = bob.Update(&types.UpdateSnapshotParams{ID: created.ID, Name: "stolen"})
	require.Error(t, err)
	_, err = bob.Delete(&types.DeleteSnapshotParams{ID: created.ID})
	require.Error(t, err)

	updated, err := alice.Update(&types.UpdateSnapshotParams{ID: created.ID, Name: "renamed", Data: `{"nodes":[1]}`})
	require.NoError(t, err)
	require.Equal(t, created.ID, updated.ID)

	detail, err = alice.Detail(&types.GetSnapshotDetailParams{ID: created.ID})
	require.NoError(t, err)
	require.Equal(t, "renamed", detail.Name)
	require.Equal(t, `{"nodes":[1]}`, detail.Data)

	deleted, err := alice.Delete(&types.DeleteSnapshotParams{ID: created.ID})
	require.NoError(t, err)
	require.Equal(t, created.ID, deleted.ID)

	_, err = alice.Detail(&types.GetSnapshotDetailParams{ID: created.ID})
	require.Error(t, err)
}

func TestSnapshotServiceRejectsInvalidDependenciesAndFilters(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	_, err := NewSnapshotService(context.Background(), serviceContext).List(&types.GetSnapshotsParams{Page: 1, PageSize: 10})
	require.Error(t, err)

	_, err = NewSnapshotService(contextWithUser("alice"), svc.NewServiceContext(config.Config{}, nil)).List(
		&types.GetSnapshotsParams{Page: 1, PageSize: 10},
	)
	require.Error(t, err)

	_, err = NewSnapshotService(contextWithUser("alice"), serviceContext).List(
		&types.GetSnapshotsParams{Page: 1, PageSize: 10, Filter: `{"name":1}`},
	)
	require.Error(t, err)
}
