package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateIconGroupLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateIconGroupLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateIconGroupLogic {
	return &UpdateIconGroupLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateIconGroupLogic) UpdateIconGroup(req *types.UpdateIconGroupParams) (resp *types.IconGroupActionResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).UpdateGroup(req)
}
