package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AddIconGroupLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewAddIconGroupLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AddIconGroupLogic {
	return &AddIconGroupLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AddIconGroupLogic) AddIconGroup(req *types.AddIconGroupParams) (resp *types.IconGroupActionResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).AddGroup(req)
}
