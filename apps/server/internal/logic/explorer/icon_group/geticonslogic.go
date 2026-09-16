package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetIconsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetIconsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetIconsLogic {
	return &GetIconsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetIconsLogic) GetIcons(req *types.GetIconParams) (resp *types.GetIconResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).ListIcons(req)
}
