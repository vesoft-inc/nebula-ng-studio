package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AddIconLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAddIconLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AddIconLogic {
	return &AddIconLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AddIconLogic) AddIcon(req *types.AddIconParams) (resp *types.IconActionResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).AddIcon(req)
}
