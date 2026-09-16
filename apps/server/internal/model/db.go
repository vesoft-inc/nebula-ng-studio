package db

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func ParseDSN(opts config.Config) (dsn string, err error) {
	switch opts.Database.Dialect {
	case "mysql":
		concate := "?"
		if strings.Contains(opts.Database.Name, concate) {
			concate = "&"
		}
		if strings.HasPrefix(opts.Database.Host, "/") {
			dsn = fmt.Sprintf("%s:%s@unix(%s)/%s%scharset=utf8mb4&parseTime=true&loc=Local",
				opts.Database.Username, opts.Database.Password, opts.Database.Host, opts.Database.Name, concate)
		} else {
			dsn = fmt.Sprintf("%s:%s@tcp(%s)/%s%scharset=utf8mb4&parseTime=true&loc=Local",
				opts.Database.Username, opts.Database.Password, opts.Database.Host, opts.Database.Name, concate)
		}

	case "sqlite3":
		dsn = "file:" + opts.Database.SqliteFilePath + "?cache=shared&mode=rwc&synchronous=off&busy_timeout=10000&journal_mode=wal&parseTime=true&loc=Local"

	default:
		return "", errors.Errorf("unrecognized dialect: %s", opts.Database.Dialect)
	}

	return dsn, nil
}

func OpenDB(opts config.Config) (*gorm.DB, error) {
	dsn, err := ParseDSN(opts)
	if err != nil {
		return nil, errors.Wrap(err, "parse DSN")
	}

	var dialector gorm.Dialector
	switch opts.Database.Dialect {
	case "mysql":
		dialector = mysql.Open(dsn)
	case "sqlite3":
		dialector = sqlite.Open(dsn)
	}

	cfg := &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
		SkipDefaultTransaction:                   true,
		Logger: logger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			logger.Config{
				SlowThreshold:        200 * time.Millisecond,
				LogLevel:             logger.LogLevel(opts.Database.LogLevel),
				Colorful:             true,
				ParameterizedQueries: true,
				// IgnoreRecordNotFoundError: false,
			},
		),
	}
	db, err := gorm.Open(dialector, cfg)
	if opts.Database.Dialect == "mysql" {
		db.Set("gorm:table_options", "ENGINE=InnoDB")
	}
	return db, err
}

func InitDB(config *config.Config) (*gorm.DB, error) {
	db, err := OpenDB(*config)
	if err != nil {
		return nil, err
	}
	if config.Database.AutoMigrate {
		if err := ApplySchemaMigrations(db); err != nil {
			return nil, err
		}
	}

	return db, nil
}
