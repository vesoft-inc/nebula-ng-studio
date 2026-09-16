package gateway

import (
	"net/http"

	logic "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/logic/gateway"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
)

func Oauth2ConfigHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		l := logic.NewOauth2ConfigLogic(r.Context(), svcCtx)
		data, err := l.Oauth2Config()
		svcCtx.ResponseHandler.Handle(w, r, data, err)
	}
}
