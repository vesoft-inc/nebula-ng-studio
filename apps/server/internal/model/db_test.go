package db

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestExplorerModelsUseExplicitTableNames(t *testing.T) {
	require.Equal(t, "explorer_snapshots", Snapshot{}.TableName())
	require.Equal(t, "explorer_icon_groups", IconGroup{}.TableName())
	require.Equal(t, "explorer_icon_items", IconItem{}.TableName())
	require.Equal(t, "explorer_global_configs", GlobalConfig{}.TableName())
	require.Equal(t, "schema_migrations", SchemaMigration{}.TableName())
}

func TestApplySchemaMigrationsCreatesOnlyCanonicalTables(t *testing.T) {
	database, err := gorm.Open(sqlite.Open("file:migrations?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, ApplySchemaMigrations(database))

	for _, table := range []string{
		"schema_migrations",
		"sketches",
		"explorer_snapshots",
		"explorer_icon_groups",
		"explorer_icon_items",
		"explorer_global_configs",
	} {
		require.Truef(t, database.Migrator().HasTable(table), "expected table %s", table)
	}
	require.NoError(t, database.Create(&Snapshot{
		ID:         "snapshot-1",
		Name:       "snapshot",
		Graph:      "graph",
		GraphType:  "graph-type",
		SchemaPath: "/schema",
		Host:       "127.0.0.1:9669",
		Username:   "alice",
	}).Error)
	require.NoError(t, ApplySchemaMigrations(database))

	var migrationCount, snapshotCount int64
	require.NoError(t, database.Model(&SchemaMigration{}).Count(&migrationCount).Error)
	require.NoError(t, database.Model(&Snapshot{}).Count(&snapshotCount).Error)
	require.EqualValues(t, 1, migrationCount)
	require.EqualValues(t, 1, snapshotCount)
}

func TestParseDSNUsesDatabaseSettings(t *testing.T) {
	t.Run("tcp mysql", func(t *testing.T) {
		cfg := config.Config{}
		cfg.Database.Dialect = "mysql"
		cfg.Database.Host = "db.example.test:3306"
		cfg.Database.Name = "studio"
		cfg.Database.Username = "user"
		cfg.Database.Password = "password"

		dsn, err := ParseDSN(cfg)
		require.NoError(t, err)
		require.Equal(t, "user:password@tcp(db.example.test:3306)/studio?charset=utf8mb4&parseTime=true&loc=Local", dsn)
	})

	t.Run("unix mysql", func(t *testing.T) {
		cfg := config.Config{}
		cfg.Database.Dialect = "mysql"
		cfg.Database.Host = "/tmp/mysql.sock"
		cfg.Database.Name = "studio"
		cfg.Database.Username = "user"
		cfg.Database.Password = "password"

		dsn, err := ParseDSN(cfg)
		require.NoError(t, err)
		require.Equal(t, "user:password@unix(/tmp/mysql.sock)/studio?charset=utf8mb4&parseTime=true&loc=Local", dsn)
	})
}
