package icon_group

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetIconGroupsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetIconGroupsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetIconGroupsLogic {
	return &GetIconGroupsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetIconGroupsLogic) GetIconGroups(req *types.GetIconGroupsParams) (resp *types.GetIconGroupsResult, err error) {
	return explorer.NewIconGroupService(l.ctx, l.svcCtx).ListGroups(req)
}
