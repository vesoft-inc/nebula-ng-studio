package gateway

import (
	"net/http"

	"github.com/vesoft-inc/go-pkg/validator"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/logic/gateway"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func Oauth2ConnectHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.Oauth2ConnectReq
		if err := httpx.Parse(r, &req); err != nil {
			svcCtx.ResponseHandler.Handle(w, r, nil, ecode.WithErrorMessage(ecode.ErrParam, err))
			return
		}
		if err := validator.Struct(&req); err != nil {
			svcCtx.ResponseHandler.Handle(w, r, nil, err)
			return
		}

		l := gateway.NewOauth2ConnectLogic(r.Context(), svcCtx)
		data, err := l.Oauth2Connect(&req)
		svcCtx.ResponseHandler.Handle(w, r, data, err)
	}
}
