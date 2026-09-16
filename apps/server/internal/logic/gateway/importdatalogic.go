package gateway

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ImportDataLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewImportDataLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ImportDataLogic {
	return &ImportDataLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ImportDataLogic) ImportData(req *types.ImportDataParams) (resp *types.AnyResp, err error) {
	return service.NewGatewayService(l.ctx, l.svcCtx).ImportData(req)
}
