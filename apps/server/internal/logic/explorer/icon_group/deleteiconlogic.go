package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteIconLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDeleteIconLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteIconLogic {
	return &DeleteIconLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteIconLogic) DeleteIcon(req *types.DeleteIconParams) (resp *types.IconActionResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).DeleteIcon(req)
}
