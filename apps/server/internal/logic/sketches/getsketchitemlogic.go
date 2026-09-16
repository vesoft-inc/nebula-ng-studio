package sketches

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetSketchItemLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetSketchItemLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetSketchItemLogic {
	return &GetSketchItemLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetSketchItemLogic) GetSketchItem(req *types.GetSketchItemRequest) (resp *types.GetSketchItemResult, err error) {
	return service.NewSketchService(l.ctx, l.svcCtx).GetSketchItem(req)
}
