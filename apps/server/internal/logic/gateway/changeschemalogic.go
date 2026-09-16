package gateway

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ChangeSchemaLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewChangeSchemaLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ChangeSchemaLogic {
	return &ChangeSchemaLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ChangeSchemaLogic) ChangeSchema(req *types.ChangeSchemaParams) (resp *types.AnyResp, err error) {
	return service.NewGatewayService(l.ctx, l.svcCtx).ChangeSchema(req)
}
