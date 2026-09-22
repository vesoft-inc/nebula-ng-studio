package main

import (
	"bytes"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestWriteStateAtomically(t *testing.T) {
	directory := filepath.Join(t.TempDir(), "state")
	require.NoError(t, os.Mkdir(directory, 0o700))
	path := filepath.Join(directory, "state")
	require.NoError(t, os.WriteFile(path, []byte("old\n"), 0o600))
	require.NoError(t, writeState(path, bytes.NewBufferString("PHASE=backed_up\n")))
	content, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, "PHASE=backed_up\n", string(content))
	info, err := os.Lstat(path)
	require.NoError(t, err)
	require.True(t, info.Mode().IsRegular())
	require.Equal(t, os.FileMode(0o600), info.Mode().Perm())
}

func TestWriteStateRejectsUnsafeDirectory(t *testing.T) {
	directory := filepath.Join(t.TempDir(), "state")
	require.NoError(t, os.Mkdir(directory, 0o755))
	err := writeState(filepath.Join(directory, "state"), bytes.NewBufferString("PHASE=backed_up\n"))
	require.ErrorContains(t, err, "mode 0700")
}

func TestInspectAndRewriteConfig(t *testing.T) {
	temp := t.TempDir()
	input := filepath.Join(temp, "legacy.yaml")
	output := filepath.Join(temp, "new.yaml")
	require.NoError(t, os.WriteFile(input, []byte(`
Host: 0.0.0.0
Port: 7001
Log:
  Mode: file
  KeepDays: 7
Auth:
  TokenSecret: keep-this-value
Database:
  Enable: true
  Dialect: sqlite3
  SqliteFilePath: ./data/studio.db
`), 0o600))

	inspected, err := inspectConfig(input)
	require.NoError(t, err)
	require.Equal(t, "sqlite3", inspected.Database.Dialect)
	require.Equal(t, "./data/studio.db", inspected.Database.SQLiteFilePath)
	require.Equal(t, "logs", inspected.Log.Path)

	require.NoError(t, rewriteConfig(input, output))
	content, err := os.ReadFile(output)
	require.NoError(t, err)
	require.Contains(t, string(content), "TokenSecret: keep-this-value")
	rewritten, err := inspectConfig(output)
	require.NoError(t, err)
	require.Equal(t, "/var/lib/nebula-studio/studio.db", rewritten.Database.SQLiteFilePath)
	require.Equal(t, "/var/log/nebula-studio", rewritten.Log.Path)
}

func TestSQLiteBackupIncludesCommittedData(t *testing.T) {
	temp := t.TempDir()
	source := filepath.Join(temp, "source.db")
	destination := filepath.Join(temp, "destination.db")
	database, err := sql.Open("sqlite3", source)
	require.NoError(t, err)
	defer database.Close()
	_, err = database.Exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES ('preserved')")
	require.NoError(t, err)
	wal, err := os.Stat(source + "-wal")
	require.NoError(t, err)
	require.Positive(t, wal.Size())

	require.NoError(t, sqliteBackup(source, destination))
	backup, err := sql.Open("sqlite3", destination)
	require.NoError(t, err)
	defer backup.Close()
	var value string
	require.NoError(t, backup.QueryRow("SELECT value FROM sample").Scan(&value))
	require.Equal(t, "preserved", value)
}

func TestRewriteRefusesEnvironmentDependentPaths(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	require.NoError(t, os.WriteFile(path, []byte(`
Log:
  Mode: file
Database:
  Enable: true
  Dialect: sqlite3
  SqliteFilePath: ${STUDIO_DATA}/studio.db
`), 0o600))
	_, err := inspectConfig(path)
	require.ErrorContains(t, err, "environment expansion")
}

func TestInspectRefusesAmbiguousYAML(t *testing.T) {
	for name, content := range map[string]string{
		"duplicate": `
Log:
  Mode: file
Database:
  Enable: true
  Dialect: sqlite3
database:
  Enable: false
  Dialect: mysql
`,
		"alias": `
defaults: &defaults
  Enable: true
  Dialect: sqlite3
Log:
  Mode: file
Database: *defaults
`,
	} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "config.yaml")
			require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
			_, err := inspectConfig(path)
			require.Error(t, err)
		})
	}
}
