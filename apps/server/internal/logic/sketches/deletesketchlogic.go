package sketches

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteSketchLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewDeleteSketchLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteSketchLogic {
	return &DeleteSketchLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteSketchLogic) DeleteSketch(req *types.DeleteSketchRequest) error {
	return service.NewSketchService(l.ctx, l.svcCtx).Delete(req)
}
