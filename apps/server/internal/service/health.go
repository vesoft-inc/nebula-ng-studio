package service

import (
	"context"
	"time"

	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
)

const (
	DatabaseReady       = "ok"
	DatabaseDisabled    = "disabled"
	DatabaseUnavailable = "unavailable"

	databaseReadinessTimeout = 2 * time.Second
)

func DatabaseReadiness(ctx context.Context, svcCtx *svc.ServiceContext) string {
	if !svcCtx.Config.Database.Enable {
		return DatabaseDisabled
	}

	checkCtx, cancel := context.WithTimeout(ctx, databaseReadinessTimeout)
	defer cancel()
	if err := db.CheckSchemaMigrations(checkCtx, svcCtx.DB); err != nil {
		return DatabaseUnavailable
	}
	return DatabaseReady
}
