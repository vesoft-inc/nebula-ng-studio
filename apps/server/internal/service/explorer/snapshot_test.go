package explorer

import (
	"context"
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

	detail, err := alice.Detail(&types.GetSnapshotDetailParams{ID: created.ID})
	require.NoError(t, err)
	require.Equal(t, `{"nodes":[]}`, detail.Data)
	require.Equal(t, "thumbnail", detail.Thumbnail)

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

func TestSnapshotServiceListAppliesAllowlistedFiltersAndOwnerScope(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	alice := NewSnapshotService(contextWithUser("alice"), serviceContext)
	bob := NewSnapshotService(contextWithUser("bob"), serviceContext)

	_, err := alice.Add(&types.AddSnapshotParams{
		Name:       "first snapshot",
		Graph:      "demo",
		GraphType:  "demo_type",
		SchemaPath: "/schema/demo",
	})
	require.NoError(t, err)
	_, err = alice.Add(&types.AddSnapshotParams{
		Name:       "analytics snapshot",
		Graph:      "analytics",
		GraphType:  "analytics_type",
		SchemaPath: "/schema/analytics",
	})
	require.NoError(t, err)
	_, err = bob.Add(&types.AddSnapshotParams{
		Name:       "bob snapshot",
		Graph:      "demo",
		GraphType:  "bob_type",
		SchemaPath: "/schema/demo",
	})
	require.NoError(t, err)

	tests := []struct {
		name   string
		filter string
		want   []string
	}{
		{
			name: "no filter",
			want: []string{"first snapshot", "analytics snapshot"},
		},
		{
			name:   "name",
			filter: `{"name":"first"}`,
			want:   []string{"first snapshot"},
		},
		{
			name:   "graph",
			filter: `{"graph":"demo"}`,
			want:   []string{"first snapshot"},
		},
		{
			name:   "schema path",
			filter: `{"schema_path":"/schema/analytics"}`,
			want:   []string{"analytics snapshot"},
		},
		{
			name:   "combined",
			filter: `{"name":"analytics","graph":"analytics","schema_path":"/schema/analytics"}`,
			want:   []string{"analytics snapshot"},
		},
		{
			name:   "legal filter with no match",
			filter: `{"name":"missing"}`,
			want:   nil,
		},
		{
			name:   "sql payload is a bound value",
			filter: `{"name":"snapshot' OR 1=1 --"}`,
			want:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list, listErr := alice.List(&types.GetSnapshotsParams{
				Page:     1,
				PageSize: 10,
				Filter:   tt.filter,
			})
			require.NoError(t, listErr)
			require.Equal(t, len(tt.want), list.Total)
			got := make([]string, 0, len(list.Items))
			for _, item := range list.Items {
				got = append(got, item.Name)
			}
			require.ElementsMatch(t, tt.want, got)
		})
	}
}

func TestSnapshotServiceRejectsInvalidFiltersBeforeDatabaseQuery(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	queryCount := countDatabaseQueries(t, serviceContext.DB)
	service := NewSnapshotService(contextWithUser("alice"), serviceContext)

	tests := []struct {
		name        string
		filter      string
		wantMessage string
	}{
		{
			name:        "invalid json",
			filter:      "not-json",
			wantMessage: "invalid character",
		},
		{
			name:        "top level array",
			filter:      "[]",
			wantMessage: "cannot unmarshal array",
		},
		{
			name:        "top level null",
			filter:      "null",
			wantMessage: "filter must be a JSON object",
		},
		{
			name:        "owner fields are rejected",
			filter:      `{"host":"attacker","username":"victim"}`,
			wantMessage: "unsupported snapshot filter field",
		},
		{
			name:        "id is rejected",
			filter:      `{"id":"snapshot-id"}`,
			wantMessage: "unsupported snapshot filter field",
		},
		{
			name:        "data is rejected",
			filter:      `{"data":"{}"}`,
			wantMessage: "unsupported snapshot filter field",
		},
		{
			name:        "unknown timestamp is rejected",
			filter:      `{"created_at":"2026-01-01"}`,
			wantMessage: "unsupported snapshot filter field",
		},
		{
			name:        "identifier payload is rejected",
			filter:      `{"name = name OR 1=1 --":"value"}`,
			wantMessage: "unsupported snapshot filter field",
		},
		{
			name:        "number value",
			filter:      `{"name":1}`,
			wantMessage: "name filter value must be a string",
		},
		{
			name:        "array value",
			filter:      `{"graph":[]}`,
			wantMessage: "graph filter value must be a string",
		},
		{
			name:        "null value",
			filter:      `{"schema_path":null}`,
			wantMessage: "schema_path filter value must be a string",
		},
		{
			name:        "object value",
			filter:      `{"name":{"nested":true}}`,
			wantMessage: "name filter value must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before := queryCount.Load()
			_, err := service.List(&types.GetSnapshotsParams{
				Page:     1,
				PageSize: 10,
				Filter:   tt.filter,
			})
			requireErrParam(t, err)
			require.Contains(t, err.Error(), tt.wantMessage)
			require.Equal(t, before, queryCount.Load(), "invalid filters must not reach the database")
		})
	}
}
