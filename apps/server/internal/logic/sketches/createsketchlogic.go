package sketches

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type CreateSketchLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewCreateSketchLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateSketchLogic {
	return &CreateSketchLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateSketchLogic) CreateSketch(req *types.CreateSketchRequest) (resp *types.SketchIDResult, err error) {
	return service.NewSketchService(l.ctx, l.svcCtx).CreateSketch(req)
}
