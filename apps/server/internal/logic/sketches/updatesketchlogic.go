package sketches

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateSketchLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewUpdateSketchLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateSketchLogic {
	return &UpdateSketchLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateSketchLogic) UpdateSketch(req *types.UpdateSketchRequest) error {
	return service.NewSketchService(l.ctx, l.svcCtx).Update(req)
}
