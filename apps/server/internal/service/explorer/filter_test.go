package explorer

import (
	"testing"

	"github.com/stretchr/testify/require"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestFilterQueryTemplatesUseFixedIdentifiersAndBindings(t *testing.T) {
	database, err := gorm.Open(
		mysql.New(mysql.Config{
			DSN:                       "studio:studio@tcp(127.0.0.1:3306)/studio?charset=utf8mb4&parseTime=True&loc=Local",
			SkipInitializeWithVersion: true,
		}),
		&gorm.Config{
			DryRun:               true,
			DisableAutomaticPing: true,
			Logger:               logger.Default.LogMode(logger.Silent),
		},
	)
	require.NoError(t, err)
	t.Cleanup(func() {
		sqlDB, sqlErr := database.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	globalFilter, err := parseGlobalConfigListFilter(
		`{"key":"key' OR 1=1 --","value":"value' OR 1=1 --"}`,
	)
	require.NoError(t, err)
	var globalConfigs []db.GlobalConfig
	globalResult := applyGlobalConfigListFilter(
		database.Model(&db.GlobalConfig{}),
		globalFilter,
	).Find(&globalConfigs)
	require.NoError(t, globalResult.Error)
	globalSQL := globalResult.Statement.SQL.String()
	require.Contains(t, globalSQL, "`key` = ?")
	require.Contains(t, globalSQL, "value = ?")
	require.NotContains(t, globalSQL, "OR 1=1")
	require.Equal(
		t,
		[]interface{}{"key' OR 1=1 --", "value' OR 1=1 --"},
		globalResult.Statement.Vars,
	)

	snapshotFilter, err := parseSnapshotListFilter(
		`{"name":"name' OR 1=1 --","graph":"graph' OR 1=1 --","schema_path":"schema' OR 1=1 --"}`,
	)
	require.NoError(t, err)
	var snapshots []db.Snapshot
	snapshotResult := applySnapshotListFilter(
		database.Model(&db.Snapshot{}).
			Where("host = ? AND username = ?", "graphd.example.test:9669", "alice"),
		snapshotFilter,
	).Find(&snapshots)
	require.NoError(t, snapshotResult.Error)
	snapshotSQL := snapshotResult.Statement.SQL.String()
	require.Contains(t, snapshotSQL, "host = ? AND username = ?")
	require.Contains(t, snapshotSQL, "name LIKE ?")
	require.Contains(t, snapshotSQL, "graph = ?")
	require.Contains(t, snapshotSQL, "schema_path = ?")
	require.NotContains(t, snapshotSQL, "OR 1=1")
	require.Equal(
		t,
		[]interface{}{
			"graphd.example.test:9669",
			"alice",
			"%name' OR 1=1 --%",
			"graph' OR 1=1 --",
			"schema' OR 1=1 --",
		},
		snapshotResult.Statement.Vars,
	)
}
