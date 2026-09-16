package db

import (
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
