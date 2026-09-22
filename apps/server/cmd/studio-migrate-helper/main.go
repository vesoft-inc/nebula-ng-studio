// studio-migrate-helper provides the structured configuration and SQLite
// operations used by scripts/migrate-nebula-graph-studio.sh. It intentionally does
// not install packages or control services.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattn/go-sqlite3"
	"gopkg.in/yaml.v3"
)

type inspectedConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database struct {
		Enable         bool   `json:"enable"`
		Dialect        string `json:"dialect"`
		SQLiteFilePath string `json:"sqliteFilePath"`
	} `json:"database"`
	Log struct {
		Mode string `json:"mode"`
		Path string `json:"path"`
	} `json:"log"`
}

func usage(w io.Writer) {
	fmt.Fprintln(w, "Usage:")
	fmt.Fprintln(w, "  studio-migrate-helper inspect-config --config <path>")
	fmt.Fprintln(w, "  studio-migrate-helper rewrite-config --input <path> --output <path>")
	fmt.Fprintln(w, "  studio-migrate-helper sqlite-backup --source <path> --destination <path>")
	fmt.Fprintln(w, "  studio-migrate-helper write-state --path <path>")
}

func writeState(path string, input io.Reader) error {
	if path == "" {
		return errors.New("state path is required")
	}
	directory := filepath.Dir(path)
	info, err := os.Lstat(directory)
	if err != nil {
		return fmt.Errorf("inspect state directory: %w", err)
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm() != 0o700 {
		return fmt.Errorf("state directory %s must be a non-symlink directory with mode 0700", directory)
	}

	temporary, err := os.CreateTemp(directory, ".state.*")
	if err != nil {
		return fmt.Errorf("create temporary state: %w", err)
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0o600); err != nil {
		temporary.Close()
		return fmt.Errorf("set temporary state permissions: %w", err)
	}
	limited := io.LimitReader(input, 64*1024+1)
	written, copyErr := io.Copy(temporary, limited)
	if copyErr == nil && written > 64*1024 {
		copyErr = errors.New("state exceeds 64 KiB")
	}
	if copyErr == nil {
		copyErr = temporary.Sync()
	}
	closeErr := temporary.Close()
	if copyErr != nil {
		return fmt.Errorf("write temporary state: %w", copyErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close temporary state: %w", closeErr)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("replace state: %w", err)
	}
	directoryHandle, err := os.Open(directory)
	if err != nil {
		return fmt.Errorf("open state directory: %w", err)
	}
	defer directoryHandle.Close()
	if err := directoryHandle.Sync(); err != nil {
		return fmt.Errorf("sync state directory: %w", err)
	}
	return nil
}

func parseYAML(path string) (*yaml.Node, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var document yaml.Node
	if err := yaml.Unmarshal(content, &document); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if len(document.Content) != 1 || document.Content[0].Kind != yaml.MappingNode {
		return nil, fmt.Errorf("%s must contain a YAML mapping", path)
	}
	if err := validateYAMLNode(document.Content[0]); err != nil {
		return nil, fmt.Errorf("validate %s: %w", path, err)
	}
	return &document, nil
}

func validateYAMLNode(node *yaml.Node) error {
	if node.Kind == yaml.AliasNode {
		return errors.New("YAML aliases are not supported for automatic migration")
	}
	if node.Kind == yaml.MappingNode {
		keys := make(map[string]struct{}, len(node.Content)/2)
		for index := 0; index+1 < len(node.Content); index += 2 {
			key := node.Content[index]
			if key.Kind != yaml.ScalarNode {
				return errors.New("YAML mapping keys must be scalar values")
			}
			normalized := strings.ToLower(key.Value)
			if _, exists := keys[normalized]; exists {
				return fmt.Errorf("duplicate YAML key %q", key.Value)
			}
			keys[normalized] = struct{}{}
		}
	}
	for _, child := range node.Content {
		if err := validateYAMLNode(child); err != nil {
			return err
		}
	}
	return nil
}

func mappingValue(mapping *yaml.Node, name string) (*yaml.Node, bool) {
	if mapping == nil || mapping.Kind != yaml.MappingNode {
		return nil, false
	}
	for index := 0; index+1 < len(mapping.Content); index += 2 {
		if strings.EqualFold(mapping.Content[index].Value, name) {
			return mapping.Content[index+1], true
		}
	}
	return nil, false
}

func scalarString(mapping *yaml.Node, name, fallback string) (string, error) {
	value, ok := mappingValue(mapping, name)
	if !ok {
		return fallback, nil
	}
	if value.Kind != yaml.ScalarNode {
		return "", fmt.Errorf("%s must be a scalar value", name)
	}
	return value.Value, nil
}

func scalarBool(mapping *yaml.Node, name string, fallback bool) (bool, error) {
	value, ok := mappingValue(mapping, name)
	if !ok {
		return fallback, nil
	}
	var result bool
	if err := value.Decode(&result); err != nil {
		return false, fmt.Errorf("%s must be a boolean: %w", name, err)
	}
	return result, nil
}

func scalarInt(mapping *yaml.Node, name string, fallback int) (int, error) {
	value, ok := mappingValue(mapping, name)
	if !ok {
		return fallback, nil
	}
	var result int
	if err := value.Decode(&result); err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", name, err)
	}
	return result, nil
}

func inspectConfig(path string) (inspectedConfig, error) {
	document, err := parseYAML(path)
	if err != nil {
		return inspectedConfig{}, err
	}
	root := document.Content[0]
	database, ok := mappingValue(root, "Database")
	if !ok || database.Kind != yaml.MappingNode {
		return inspectedConfig{}, errors.New("Database must be a YAML mapping")
	}
	logConfig, ok := mappingValue(root, "Log")
	if !ok || logConfig.Kind != yaml.MappingNode {
		return inspectedConfig{}, errors.New("Log must be a YAML mapping")
	}

	var result inspectedConfig
	if result.Host, err = scalarString(root, "Host", "0.0.0.0"); err != nil {
		return inspectedConfig{}, err
	}
	if result.Port, err = scalarInt(root, "Port", 7001); err != nil {
		return inspectedConfig{}, err
	}
	if result.Database.Enable, err = scalarBool(database, "Enable", true); err != nil {
		return inspectedConfig{}, err
	}
	if result.Database.Dialect, err = scalarString(database, "Dialect", ""); err != nil {
		return inspectedConfig{}, err
	}
	if result.Database.SQLiteFilePath, err = scalarString(database, "SqliteFilePath", "data/studio.db"); err != nil {
		return inspectedConfig{}, err
	}
	if result.Log.Mode, err = scalarString(logConfig, "Mode", "console"); err != nil {
		return inspectedConfig{}, err
	}
	if result.Log.Path, err = scalarString(logConfig, "Path", "logs"); err != nil {
		return inspectedConfig{}, err
	}
	for name, value := range map[string]string{
		"Database.Dialect":        result.Database.Dialect,
		"Database.SqliteFilePath": result.Database.SQLiteFilePath,
		"Log.Path":                result.Log.Path,
	} {
		if strings.Contains(value, "$") {
			return inspectedConfig{}, fmt.Errorf("%s uses environment expansion and cannot be migrated automatically", name)
		}
	}
	return result, nil
}

func setScalar(mapping *yaml.Node, name, value string) {
	if current, ok := mappingValue(mapping, name); ok {
		current.Kind = yaml.ScalarNode
		current.Tag = "!!str"
		current.Value = value
		current.Content = nil
		return
	}
	mapping.Content = append(mapping.Content,
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: name},
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: value},
	)
}

func rewriteConfig(input, output string) error {
	inspected, err := inspectConfig(input)
	if err != nil {
		return err
	}
	document, err := parseYAML(input)
	if err != nil {
		return err
	}
	root := document.Content[0]
	logConfig, _ := mappingValue(root, "Log")
	database, _ := mappingValue(root, "Database")
	setScalar(logConfig, "Path", "/var/log/nebula-studio")
	if inspected.Database.Dialect == "sqlite3" {
		setScalar(database, "SqliteFilePath", "/var/lib/nebula-studio/studio.db")
	}

	file, err := os.OpenFile(output, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return fmt.Errorf("create %s: %w", output, err)
	}
	encoder := yaml.NewEncoder(file)
	encoder.SetIndent(2)
	encodeErr := encoder.Encode(document.Content[0])
	closeErr := file.Close()
	if encodeErr != nil {
		return fmt.Errorf("encode %s: %w", output, encodeErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close %s: %w", output, closeErr)
	}
	return nil
}

func sqliteBackup(source, destination string) error {
	if source == "" || destination == "" {
		return errors.New("source and destination are required")
	}
	if _, err := os.Stat(destination); !errors.Is(err, os.ErrNotExist) {
		if err == nil {
			return fmt.Errorf("destination %s already exists", destination)
		}
		return fmt.Errorf("inspect destination %s: %w", destination, err)
	}
	if err := os.MkdirAll(filepath.Dir(destination), 0o700); err != nil {
		return fmt.Errorf("create destination directory: %w", err)
	}

	sourceURL := &url.URL{Scheme: "file", Path: source}
	query := sourceURL.Query()
	query.Set("mode", "ro")
	query.Set("_busy_timeout", "5000")
	sourceURL.RawQuery = query.Encode()
	sourceDB, err := sql.Open("sqlite3", sourceURL.String())
	if err != nil {
		return fmt.Errorf("open source database: %w", err)
	}
	defer sourceDB.Close()
	destinationDB, err := sql.Open("sqlite3", destination)
	if err != nil {
		return fmt.Errorf("open destination database: %w", err)
	}
	defer destinationDB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	destinationConnection, err := destinationDB.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire destination connection: %w", err)
	}
	defer destinationConnection.Close()
	sourceConnection, err := sourceDB.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire source connection: %w", err)
	}
	defer sourceConnection.Close()

	return destinationConnection.Raw(func(destinationDriver any) error {
		destinationSQLite, ok := destinationDriver.(*sqlite3.SQLiteConn)
		if !ok {
			return errors.New("unexpected destination SQLite driver")
		}
		return sourceConnection.Raw(func(sourceDriver any) error {
			sourceSQLite, ok := sourceDriver.(*sqlite3.SQLiteConn)
			if !ok {
				return errors.New("unexpected source SQLite driver")
			}
			backup, err := destinationSQLite.Backup("main", sourceSQLite, "main")
			if err != nil {
				return fmt.Errorf("initialize SQLite backup: %w", err)
			}
			for {
				if err := ctx.Err(); err != nil {
					_ = backup.Finish()
					return fmt.Errorf("copy SQLite pages: %w", err)
				}
				done, stepErr := backup.Step(128)
				if stepErr != nil {
					_ = backup.Finish()
					return fmt.Errorf("copy SQLite pages: %w", stepErr)
				}
				if done {
					break
				}
				select {
				case <-ctx.Done():
					_ = backup.Finish()
					return fmt.Errorf("copy SQLite pages: %w", ctx.Err())
				case <-time.After(10 * time.Millisecond):
				}
			}
			if err := backup.Finish(); err != nil {
				return fmt.Errorf("finish SQLite backup: %w", err)
			}
			return nil
		})
	})
}

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr)
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "inspect-config":
		flags := flag.NewFlagSet(os.Args[1], flag.ContinueOnError)
		configPath := flags.String("config", "", "configuration file")
		field := flags.String("field", "", "print one migration-safe field")
		if err = flags.Parse(os.Args[2:]); err == nil && *configPath == "" {
			err = errors.New("--config is required")
		}
		if err == nil {
			var result inspectedConfig
			result, err = inspectConfig(*configPath)
			if err == nil {
				if *field == "" {
					err = json.NewEncoder(os.Stdout).Encode(result)
				} else {
					switch *field {
					case "host":
						fmt.Fprintln(os.Stdout, result.Host)
					case "port":
						fmt.Fprintln(os.Stdout, result.Port)
					case "database.enable":
						fmt.Fprintln(os.Stdout, result.Database.Enable)
					case "database.dialect":
						fmt.Fprintln(os.Stdout, result.Database.Dialect)
					case "database.sqliteFilePath":
						fmt.Fprintln(os.Stdout, result.Database.SQLiteFilePath)
					case "log.mode":
						fmt.Fprintln(os.Stdout, result.Log.Mode)
					case "log.path":
						fmt.Fprintln(os.Stdout, result.Log.Path)
					default:
						err = fmt.Errorf("unsupported field %q", *field)
					}
				}
			}
		}
	case "rewrite-config":
		flags := flag.NewFlagSet(os.Args[1], flag.ContinueOnError)
		input := flags.String("input", "", "source configuration")
		output := flags.String("output", "", "destination configuration")
		if err = flags.Parse(os.Args[2:]); err == nil && (*input == "" || *output == "") {
			err = errors.New("--input and --output are required")
		}
		if err == nil {
			err = rewriteConfig(*input, *output)
		}
	case "sqlite-backup":
		flags := flag.NewFlagSet(os.Args[1], flag.ContinueOnError)
		source := flags.String("source", "", "source SQLite database")
		destination := flags.String("destination", "", "destination SQLite database")
		if err = flags.Parse(os.Args[2:]); err == nil {
			err = sqliteBackup(*source, *destination)
		}
	case "write-state":
		flags := flag.NewFlagSet(os.Args[1], flag.ContinueOnError)
		statePath := flags.String("path", "", "migration state file")
		if err = flags.Parse(os.Args[2:]); err == nil {
			err = writeState(*statePath, os.Stdin)
		}
	default:
		usage(os.Stderr)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
