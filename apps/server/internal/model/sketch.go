package db

import (
	"time"

	"gorm.io/gorm"
)

type Sketch struct {
	ID          int       `gorm:"column:id;primaryKey;autoIncrement"`
	Name        string    `gorm:"column:name;type:varchar(255);not null"`
	IfNotExists bool      `gorm:"column:if_not_exists;type:bool;default:false;not null"`
	Schema      string    `gorm:"column:schema;type:mediumtext;"`
	Snapshot    string    `gorm:"column:snapshot;type:mediumtext;"`
	Host        string    `gorm:"column:host;type:varchar(256);not null"`
	Username    string    `gorm:"column:username;type:varchar(128);not null"`
	CreateTime  time.Time `gorm:"column:create_time;type:datetime;autoCreateTime"`
	UpdateTime  time.Time `gorm:"column:update_time;type:datetime;autoUpdateTime"`

	DeletedAt gorm.DeletedAt `gorm:"column:deleted_at;index;type:datetime"`
}
