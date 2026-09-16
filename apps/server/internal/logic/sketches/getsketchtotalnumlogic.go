package sketches

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetSketchTotalNumLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewGetSketchTotalNumLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetSketchTotalNumLogic {
	return &GetSketchTotalNumLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetSketchTotalNumLogic) GetSketchTotalNum() (resp *types.SketchTotalNumResult, err error) {
	return service.NewSketchService(l.ctx, l.svcCtx).GetTotal()
}
