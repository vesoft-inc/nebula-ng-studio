package gateway

import (
	"context"
	"net/http"

	"github.com/vesoft-inc/go-pkg/validator"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/logic/gateway"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/oauth2auth"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func Oauth2CallbackHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.Oauth2CallbackReq
		if err := httpx.Parse(r, &req); err != nil {
			svcCtx.ResponseHandler.Handle(w, r, nil, ecode.WithErrorMessage(ecode.ErrParam, err))
			return
		}
		if err := validator.Struct(&req); err != nil {
			svcCtx.ResponseHandler.Handle(w, r, nil, err)
			return
		}

		cookieVal := ""
		if cookie, err := r.Cookie(oauth2auth.FlowCookieName); err == nil {
			cookieVal = cookie.Value
		}
		ctx := context.WithValue(r.Context(), "oauth2_cookie", cookieVal)
		l := gateway.NewOauth2CallbackLogic(ctx, svcCtx)
		if err := l.Oauth2Callback(&req); err != nil {
			svcCtx.ResponseHandler.Handle(w, r, nil, err)
		}
	}
}
