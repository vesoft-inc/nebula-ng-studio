package db

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type SchemaMigration struct {
	ID        string    `gorm:"column:id;primaryKey;type:varchar(128)"`
	AppliedAt time.Time `gorm:"column:applied_at;not null"`
}

func (SchemaMigration) TableName() string {
	return "schema_migrations"
}

type migration struct {
	id    string
	apply func(*gorm.DB) error
}

var schemaMigrations = []migration{
	{
		id: "0001_studio_and_explorer_schema",
		apply: func(database *gorm.DB) error {
			return database.AutoMigrate(
				&Sketch{},
				&Snapshot{},
				&IconGroup{},
				&IconItem{},
				&GlobalConfig{},
			)
		},
	},
}

func ApplySchemaMigrations(database *gorm.DB) error {
	if err := database.AutoMigrate(&SchemaMigration{}); err != nil {
		return fmt.Errorf("create schema migration table: %w", err)
	}

	for _, item := range schemaMigrations {
		var applied int64
		if err := database.Model(&SchemaMigration{}).Where("id = ?", item.id).Count(&applied).Error; err != nil {
			return fmt.Errorf("check schema migration %s: %w", item.id, err)
		}
		if applied > 0 {
			continue
		}

		if err := database.Transaction(func(transaction *gorm.DB) error {
			if err := item.apply(transaction); err != nil {
				return err
			}
			return transaction.Create(&SchemaMigration{ID: item.id, AppliedAt: time.Now()}).Error
		}); err != nil {
			return fmt.Errorf("apply schema migration %s: %w", item.id, err)
		}
	}

	return nil
}

// CheckSchemaMigrations verifies that the database connection is usable and
// every migration known to this binary has been applied. It never mutates the
// database.
func CheckSchemaMigrations(ctx context.Context, database *gorm.DB) error {
	if database == nil {
		return fmt.Errorf("database is not initialized")
	}

	sqlDB, err := database.DB()
	if err != nil {
		return fmt.Errorf("get database connection: %w", err)
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	for _, item := range schemaMigrations {
		var applied int64
		if err := database.WithContext(ctx).Model(&SchemaMigration{}).Where("id = ?", item.id).Count(&applied).Error; err != nil {
			return fmt.Errorf("check schema migration %s: %w", item.id, err)
		}
		if applied == 0 {
			return fmt.Errorf("schema migration %s is not applied", item.id)
		}
	}

	return nil
}
