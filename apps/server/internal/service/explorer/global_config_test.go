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

func TestGlobalConfigServiceListAppliesAllowlistedFilters(t *testing.T) {
	service := NewGlobalConfigService(contextWithUser("alice"), newExplorerServiceContext(t))
	_, err := service.Add(&types.AddGlobalConfigParams{Key: "appearance", Value: "dark"})
	require.NoError(t, err)
	_, err = service.Add(&types.AddGlobalConfigParams{Key: "feature", Value: "light"})
	require.NoError(t, err)

	tests := []struct {
		name   string
		filter string
		want   []string
	}{
		{
			name: "no filter",
			want: []string{"appearance", "feature"},
		},
		{
			name:   "empty filter",
			filter: "{}",
			want:   []string{"appearance", "feature"},
		},
		{
			name:   "key",
			filter: `{"key":"appearance"}`,
			want:   []string{"appearance"},
		},
		{
			name:   "value",
			filter: `{"value":"light"}`,
			want:   []string{"feature"},
		},
		{
			name:   "combined",
			filter: `{"key":"appearance","value":"dark"}`,
			want:   []string{"appearance"},
		},
		{
			name:   "sql payload is a bound value",
			filter: `{"key":"appearance' OR 1=1 --"}`,
			want:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list, listErr := service.List(&types.GetGlobalConfigsParams{
				Page:     1,
				PageSize: 10,
				Filter:   tt.filter,
			})
			require.NoError(t, listErr)
			require.Equal(t, len(tt.want), list.Total)
			got := make([]string, 0, len(list.Items))
			for _, item := range list.Items {
				got = append(got, item.Key)
			}
			require.ElementsMatch(t, tt.want, got)
		})
	}
}

func TestGlobalConfigServiceRejectsInvalidFiltersBeforeDatabaseQuery(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	queryCount := countDatabaseQueries(t, serviceContext.DB)
	service := NewGlobalConfigService(contextWithUser("alice"), serviceContext)

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
			name:        "top level null",
			filter:      "null",
			wantMessage: "filter must be a JSON object",
		},
		{
			name:        "unknown field",
			filter:      `{"updated_at":"2026-01-01"}`,
			wantMessage: "unsupported global config filter field",
		},
		{
			name:        "owner field is rejected",
			filter:      `{"host":"attacker"}`,
			wantMessage: "unsupported global config filter field",
		},
		{
			name:        "identifier payload is rejected",
			filter:      `{"key = key OR 1=1 --":"value"}`,
			wantMessage: "unsupported global config filter field",
		},
		{
			name:        "number value",
			filter:      `{"key":1}`,
			wantMessage: "key filter value must be a string",
		},
		{
			name:        "array value",
			filter:      `{"value":[]}`,
			wantMessage: "value filter value must be a string",
		},
		{
			name:        "null value",
			filter:      `{"key":null}`,
			wantMessage: "key filter value must be a string",
		},
		{
			name:        "object value",
			filter:      `{"value":{"nested":true}}`,
			wantMessage: "value filter value must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			before := queryCount.Load()
			_, err := service.List(&types.GetGlobalConfigsParams{
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
