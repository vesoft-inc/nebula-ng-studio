package db

import "time"

type GlobalConfig struct {
	Key       string    `gorm:"column:key;primaryKey;type:varchar(255)"`
	Value     string    `gorm:"column:value;type:longtext;not null"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (GlobalConfig) TableName() string {
	return "explorer_global_configs"
}
