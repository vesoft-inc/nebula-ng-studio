package gateway

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ExecConsoleGQLLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewExecConsoleGQLLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ExecConsoleGQLLogic {
	return &ExecConsoleGQLLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ExecConsoleGQLLogic) ExecConsoleGQL(req *types.ExecGQLParams) (resp *types.AnyResp, err error) {
	return service.NewGatewayService(l.ctx, l.svcCtx).ExecConsoleGQL(req)
}
