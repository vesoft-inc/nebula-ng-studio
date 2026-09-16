package global_config

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetGlobalConfigsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get Global Config List
func NewGetGlobalConfigsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetGlobalConfigsLogic {
	return &GetGlobalConfigsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetGlobalConfigsLogic) GetGlobalConfigs(req *types.GetGlobalConfigsParams) (resp *types.GetGlobalConfigsResult, err error) {
	return explorer.NewGlobalConfigService(l.ctx, l.svcCtx).List(req)
}
