package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteIconGroupLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDeleteIconGroupLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteIconGroupLogic {
	return &DeleteIconGroupLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteIconGroupLogic) DeleteIconGroup(req *types.DeleteIconGroupParams) (resp *types.IconGroupActionResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).DeleteGroup(req)
}
