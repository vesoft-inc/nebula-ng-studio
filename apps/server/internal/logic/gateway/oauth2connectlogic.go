package gateway

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type Oauth2ConnectLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewOauth2ConnectLogic(ctx context.Context, svcCtx *svc.ServiceContext) *Oauth2ConnectLogic {
	return &Oauth2ConnectLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *Oauth2ConnectLogic) Oauth2Connect(req *types.Oauth2ConnectReq) (*types.Oauth2ConnectResp, error) {
	return service.NewOauth2Service(l.ctx, l.svcCtx).Connect(req)
}
