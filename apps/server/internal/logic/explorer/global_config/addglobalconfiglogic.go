package global_config

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AddGlobalConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Add Global Config
func NewAddGlobalConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AddGlobalConfigLogic {
	return &AddGlobalConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AddGlobalConfigLogic) AddGlobalConfig(req *types.AddGlobalConfigParams) (resp *types.GlobalConfigActionResult, err error) {
	return explorer.NewGlobalConfigService(l.ctx, l.svcCtx).Add(req)
}
