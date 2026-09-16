package global_config

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetGlobalConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get Global Config Detail
func NewGetGlobalConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetGlobalConfigLogic {
	return &GetGlobalConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetGlobalConfigLogic) GetGlobalConfig(req *types.GetGlobalConfigParams) (resp *types.GlobalConfigItem, err error) {
	return explorer.NewGlobalConfigService(l.ctx, l.svcCtx).Detail(req)
}
