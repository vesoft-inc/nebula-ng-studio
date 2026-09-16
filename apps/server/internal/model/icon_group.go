package db

import "time"

type IconGroup struct {
	ID         int       `gorm:"column:id;primaryKey;autoIncrement"`
	BID        string    `gorm:"column:b_id;not null;type:char(32);uniqueIndex;comment:group id"`
	Name       string    `gorm:"column:name;type:varchar(255);not null"`
	Host       string    `gorm:"column:host;type:varchar(256);not null;index:idx_explorer_icon_group_owner"`
	Username   string    `gorm:"column:username;type:varchar(128);not null;index:idx_explorer_icon_group_owner"`
	Type       string    `gorm:"column:type;type:varchar(32);not null"`
	CreateTime time.Time `gorm:"column:create_time;autoCreateTime"`
	UpdateTime time.Time `gorm:"column:update_time;autoUpdateTime"`
}

func (IconGroup) TableName() string {
	return "explorer_icon_groups"
}

type IconItem struct {
	ID         int       `gorm:"column:id;primaryKey;autoIncrement"`
	BID        string    `gorm:"column:b_id;not null;type:char(32);uniqueIndex;comment:icon id"`
	Name       string    `gorm:"column:name;type:varchar(255);not null"`
	GroupID    string    `gorm:"column:group_id;type:char(32);not null;index"`
	Icon       string    `gorm:"column:icon;type:mediumtext"`
	CreateTime time.Time `gorm:"column:create_time;autoCreateTime"`
}

func (IconItem) TableName() string {
	return "explorer_icon_items"
}
