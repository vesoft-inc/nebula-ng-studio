package sketches

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetSketchListLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetSketchListLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetSketchListLogic {
	return &GetSketchListLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetSketchListLogic) GetSketchList(req *types.GetSketchesRequest) (resp *types.SketchList, err error) {
	return service.NewSketchService(l.ctx, l.svcCtx).GetList(req)
}
