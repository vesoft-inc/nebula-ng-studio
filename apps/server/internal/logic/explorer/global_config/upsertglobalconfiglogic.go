package global_config

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpsertGlobalConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Upsert Global Config
func NewUpsertGlobalConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpsertGlobalConfigLogic {
	return &UpsertGlobalConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpsertGlobalConfigLogic) UpsertGlobalConfig(req *types.UpsertGlobalConfigParams) (resp *types.UpsertGlobalConfigResult, err error) {
	return explorer.NewGlobalConfigService(l.ctx, l.svcCtx).Upsert(req)
}
