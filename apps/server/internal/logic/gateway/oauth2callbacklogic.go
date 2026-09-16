package gateway

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type Oauth2CallbackLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewOauth2CallbackLogic(ctx context.Context, svcCtx *svc.ServiceContext) *Oauth2CallbackLogic {
	return &Oauth2CallbackLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *Oauth2CallbackLogic) Oauth2Callback(req *types.Oauth2CallbackReq) error {
	return service.NewOauth2Service(l.ctx, l.svcCtx).Callback(req)
}
