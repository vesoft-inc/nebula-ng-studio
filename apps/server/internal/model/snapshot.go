package db

import "time"

type Snapshot struct {
	Key        int       `gorm:"column:key;primaryKey;autoIncrement"`
	ID         string    `gorm:"column:id;not null;type:char(32);uniqueIndex"`
	Name       string    `gorm:"column:name;type:varchar(255);not null"`
	Graph      string    `gorm:"column:graph;type:varchar(511);not null"`
	GraphType  string    `gorm:"column:graph_type;type:varchar(511);not null"`
	SchemaPath string    `gorm:"column:schema_path;type:varchar(255);not null"`
	Host       string    `gorm:"column:host;type:varchar(255);not null;index:idx_explorer_snapshot_owner"`
	Username   string    `gorm:"column:username;type:varchar(255);not null;index:idx_explorer_snapshot_owner"`
	Data       string    `gorm:"column:data;type:longtext"`
	Thumbnail  string    `gorm:"column:thumbnail;type:mediumtext"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (Snapshot) TableName() string {
	return "explorer_snapshots"
}
