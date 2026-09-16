package global_config

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateGlobalConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Update Global Config
func NewUpdateGlobalConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateGlobalConfigLogic {
	return &UpdateGlobalConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateGlobalConfigLogic) UpdateGlobalConfig(req *types.UpdateGlobalConfigParams) (resp *types.GlobalConfigActionResult, err error) {
	return explorer.NewGlobalConfigService(l.ctx, l.svcCtx).Update(req)
}
