package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/vesoft-inc/go-pkg/middleware"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/oauth2auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version"
	"github.com/zeromicro/go-zero/core/logx"
)

type Oauth2Service interface {
	Config() (*types.Oauth2ConfigResp, error)
	Connect(req *types.Oauth2ConnectReq) (*types.Oauth2ConnectResp, error)
	Callback(req *types.Oauth2CallbackReq) error
}

type oauth2Service struct {
	logx.Logger
	ctx          context.Context
	svcCtx       *svc.ServiceContext
	dependencies oauth2Dependencies
}

type oauth2Dependencies struct {
	pingGraphd  func(address, username, token, serverName string) (string, error)
	newClient   func(address, username, token, serverName, schemaPath string, timeoutSeconds int) (*nebula.Client, error)
	storeClient func(client *nebula.Client)
}

func NewOauth2Service(ctx context.Context, svcCtx *svc.ServiceContext) Oauth2Service {
	return newOauth2Service(ctx, svcCtx, oauth2Dependencies{
		pingGraphd: nebula.PingWithOAuth2ClientInfo,
		newClient:  nebula.NewOAuth2Client,
		storeClient: func(client *nebula.Client) {
			client.PutToContainer(client.ID)
		},
	})
}

func newOauth2Service(ctx context.Context, svcCtx *svc.ServiceContext, dependencies oauth2Dependencies) *oauth2Service {
	return &oauth2Service{
		Logger:       logx.WithContext(ctx),
		ctx:          ctx,
		svcCtx:       svcCtx,
		dependencies: dependencies,
	}
}

func studioOauth2Enabled(c config.Config) bool {
	return c.SSO.Oauth2.Enable
}

func (s *oauth2Service) Config() (*types.Oauth2ConfigResp, error) {
	return &types.Oauth2ConfigResp{Enabled: studioOauth2Enabled(s.svcCtx.Config)}, nil
}

func (s *oauth2Service) Connect(req *types.Oauth2ConnectReq) (*types.Oauth2ConnectResp, error) {
	oauth2Cfg := getStudioOauth2Config(s.svcCtx.Config)
	if !studioOauth2Enabled(s.svcCtx.Config) {
		return &types.Oauth2ConnectResp{}, nil
	}
	if oauth2Cfg.AuthURL == "" {
		return nil, fmt.Errorf("OAuth2 AuthURL is not configured")
	}
	if oauth2Cfg.ServerName == "" {
		return nil, fmt.Errorf("OAuth2 ServerName is not configured")
	}

	state, err := oauth2auth.GenerateRandomString(16)
	if err != nil {
		return nil, fmt.Errorf("failed to generate state: %w", err)
	}
	verifier := ""
	if oauth2Cfg.UsesPKCE() {
		verifier, err = oauth2auth.GenerateRandomString(32)
		if err != nil {
			return nil, fmt.Errorf("failed to generate code verifier: %w", err)
		}
	}

	flowID, err := oauth2auth.GenerateRandomString(24)
	if err != nil {
		return nil, fmt.Errorf("failed to generate oauth2 flow id: %w", err)
	}
	if err := oauth2auth.GetFlowStore().Set(flowID, &oauth2auth.FlowContext{
		Verifier: verifier,
		State:    state,
		Host:     strings.TrimSpace(req.Address),
	}); err != nil {
		return nil, fmt.Errorf("failed to store oauth2 flow: %w", err)
	}

	cookieValue, err := oauth2auth.SignFlowID(flowID, s.svcCtx.Config.Auth.TokenSecret)
	if err != nil {
		oauth2auth.GetFlowStore().Delete(flowID)
		return nil, fmt.Errorf("failed to sign oauth2 flow cookie: %w", err)
	}

	httpRes, ok := middleware.GetResponseWriter(s.ctx)
	if !ok {
		oauth2auth.GetFlowStore().Delete(flowID)
		return nil, fmt.Errorf("failed to set auth cookie")
	}
	http.SetCookie(httpRes, flowCookie(cookieValue, s.svcCtx.Config))

	return &types.Oauth2ConnectResp{
		AuthURL:  oauth2auth.BuildAuthURL(oauth2Cfg, state, verifier),
		ClientID: oauth2Cfg.ClientID,
	}, nil
}

func (s *oauth2Service) Callback(req *types.Oauth2CallbackReq) error {
	httpRes, ok := middleware.GetResponseWriter(s.ctx)
	if !ok {
		return fmt.Errorf("failed to get response writer")
	}

	cookieStr, _ := s.ctx.Value("oauth2_cookie").(string)
	if cookieStr == "" {
		return fmt.Errorf("session expired or invalid, please try login again")
	}
	flowID, err := oauth2auth.ParseFlowIDCookie(cookieStr, s.svcCtx.Config.Auth.TokenSecret)
	if err != nil {
		return fmt.Errorf("invalid oauth2 context")
	}
	flow, exists := oauth2auth.GetFlowStore().Consume(flowID)
	if !exists {
		return fmt.Errorf("session expired or invalid, please try login again")
	}
	if req.State != flow.State {
		return fmt.Errorf("state mismatch, potential CSRF attack")
	}

	oauth2Cfg := getStudioOauth2Config(s.svcCtx.Config)
	token, err := oauth2auth.ExchangeCode(s.ctx, oauth2Cfg, req.Code, flow.Verifier)
	if err != nil {
		return fmt.Errorf("failed to exchange code: %w", err)
	}
	if token.AccessToken == "" {
		return fmt.Errorf("access token is empty")
	}
	username, err := oauth2auth.FetchUsername(s.ctx, oauth2Cfg, token)
	if err != nil {
		return fmt.Errorf("failed to get user info: %w", err)
	}

	coreVersion, err := s.dependencies.pingGraphd(flow.Host, username, token.AccessToken, oauth2Cfg.ServerName)
	if err != nil {
		return fmt.Errorf("failed to connect to graph database: %w", err)
	}
	client, err := s.dependencies.newClient(flow.Host, username, token.AccessToken, oauth2Cfg.ServerName, "", 0)
	if err != nil || client == nil {
		return fmt.Errorf("failed to create graph database client: %w", err)
	}
	s.dependencies.storeClient(client)

	oauth2SessionID, err := oauth2auth.GenerateRandomString(24)
	if err != nil {
		nebula.RemoveClient(client.ID)
		return fmt.Errorf("failed to generate oauth2 session id: %w", err)
	}
	oauth2auth.GetTokenSessionStore().SetToken(oauth2SessionID, token, oauth2Cfg.ServerName)

	tokenString, err := auth.CreateToken(&auth.AuthData{
		Address:          flow.Host,
		Username:         username,
		Password:         "",
		ClientID:         client.ID,
		CoreVersion:      coreVersion,
		Version:          version.Value,
		Token:            "",
		OAuth2SessionID:  oauth2SessionID,
		OAuth2ServerName: oauth2Cfg.ServerName,
	}, &s.svcCtx.Config)
	if err != nil {
		nebula.RemoveClient(client.ID)
		oauth2auth.GetTokenSessionStore().Delete(oauth2SessionID)
		return fmt.Errorf("failed to create token: %w", err)
	}

	http.SetCookie(httpRes, utils.DisabledCookie(oauth2auth.FlowCookieName, httpsEnabled(s.svcCtx.Config)))
	http.SetCookie(httpRes, authCookie(tokenString, s.svcCtx.Config))
	httpReq, ok := middleware.GetRequest(s.ctx)
	if !ok {
		return nil
	}
	http.Redirect(httpRes, httpReq, oauth2CallbackRedirectPath(s.svcCtx.Config), http.StatusFound)
	return nil
}

func getStudioOauth2Config(c config.Config) oauth2auth.Config {
	return oauth2auth.Config{
		Enable:         c.SSO.Oauth2.Enable,
		ServerName:     c.SSO.Oauth2.ServerName,
		AuthURL:        c.SSO.Oauth2.AuthURL,
		AccessTokenURL: c.SSO.Oauth2.AccessTokenURL,
		ClientID:       c.SSO.Oauth2.ClientID,
		ClientSecret:   c.SSO.Oauth2.ClientSecret,
		RedirectURL:    c.SSO.Oauth2.RedirectURL,
		UserInfoURL:    c.SSO.Oauth2.UserInfoURL,
		Scope:          c.SSO.Oauth2.Scope,
		UsernameField:  c.SSO.Oauth2.UsernameField,
	}
}

func flowCookie(value string, c config.Config) *http.Cookie {
	cookie := &http.Cookie{
		Name:     oauth2auth.FlowCookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   300,
	}
	if httpsEnabled(c) {
		cookie.Secure = true
		cookie.SameSite = http.SameSiteNoneMode
	}
	return cookie
}

func authCookie(tokenString string, c config.Config) *http.Cookie {
	cookie := &http.Cookie{
		Name:     c.Auth.TokenName,
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   int(c.Auth.TokenMaxAge),
	}
	if httpsEnabled(c) {
		cookie.Secure = true
		cookie.SameSite = http.SameSiteNoneMode
	}
	return cookie
}

func httpsEnabled(c config.Config) bool {
	return c.CertFile != "" && c.KeyFile != ""
}

func oauth2CallbackRedirectPath(c config.Config) string {
	basePath := strings.Trim(strings.TrimSpace(c.BasePath), "/")
	if basePath == "" {
		return "/"
	}
	return "/" + basePath
}
