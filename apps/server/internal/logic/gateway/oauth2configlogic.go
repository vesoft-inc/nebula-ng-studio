package gateway

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/zeromicro/go-zero/core/logx"
)

type Oauth2ConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewOauth2ConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *Oauth2ConfigLogic {
	return &Oauth2ConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *Oauth2ConfigLogic) Oauth2Config() (*types.Oauth2ConfigResp, error) {
	return service.NewOauth2Service(l.ctx, l.svcCtx).Config()
}
