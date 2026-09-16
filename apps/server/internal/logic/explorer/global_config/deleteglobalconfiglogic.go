package global_config

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteGlobalConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Delete Global Config
func NewDeleteGlobalConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteGlobalConfigLogic {
	return &DeleteGlobalConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteGlobalConfigLogic) DeleteGlobalConfig(req *types.DeleteGlobalConfigParams) (resp *types.GlobalConfigActionResult, err error) {
	return explorer.NewGlobalConfigService(l.ctx, l.svcCtx).Delete(req)
}
