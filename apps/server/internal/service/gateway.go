package service

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/vesoft-inc/go-pkg/middleware"
	"github.com/vesoft-inc/go-pkg/response"
	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/dataset"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/oauth2auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"

	"github.com/zeromicro/go-zero/core/logx"
)

var _ GatewayService = (*gatewayService)(nil)

type (
	GatewayService interface {
		Connect(req *types.ConnectDBParams) error
		Disconnect() (*types.AnyResp, error)
		ExecGQL(req *types.ExecGQLParams) (*types.AnyResp, error)
		GetUserInfo() (*types.UserInfo, error)
		ChangeSchema(req *types.ChangeSchemaParams) (*types.AnyResp, error)
		ExecConsoleGQL(req *types.ExecGQLParams) (*types.AnyResp, error)
		ImportData(req *types.ImportDataParams) (*types.AnyResp, error)
	}

	gatewayService struct {
		logx.Logger
		ctx              context.Context
		svcCtx           *svc.ServiceContext
		withErrorMessage utils.WithErrorMessage
	}
)

func NewGatewayService(ctx context.Context, svcCtx *svc.ServiceContext) GatewayService {
	return &gatewayService{
		Logger:           logx.WithContext(ctx),
		ctx:              ctx,
		svcCtx:           svcCtx,
		withErrorMessage: utils.ErrMsgWithLogger(ctx),
	}
}

func (s *gatewayService) Connect(request *types.ConnectDBParams) error {
	httpRes, _ := middleware.GetResponseWriter(s.ctx)

	tokenString, err := auth.ParseConnectDBParams(request, &s.svcCtx.Config)
	if err != nil {
		return s.withErrorMessage(ecode.ErrBadRequest, err, "parse request failed")
	}

	configAuth := s.svcCtx.Config.Auth
	tokenCookie := http.Cookie{
		Name:     configAuth.TokenName,
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   int(configAuth.TokenMaxAge),
	}

	httpsEnable := s.svcCtx.Config.CertFile != "" && s.svcCtx.Config.KeyFile != ""
	if httpsEnable {
		tokenCookie.Secure = true
		tokenCookie.SameSite = http.SameSiteNoneMode
	}

	httpRes.Header().Add("Set-Cookie", tokenCookie.String())

	return nil
}

func (s *gatewayService) Disconnect() (*types.AnyResp, error) {
	httpRes, _ := middleware.GetResponseWriter(s.ctx)
	configAuth := s.svcCtx.Config.Auth
	httpsEnable := s.svcCtx.Config.CertFile != "" && s.svcCtx.Config.KeyFile != ""
	authData := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	nebula.RemoveClient(authData.ClientID)
	if authData.OAuth2SessionID != "" {
		oauth2auth.GetTokenSessionStore().Delete(authData.OAuth2SessionID)
	}
	httpRes.Header().Set("Set-Cookie", utils.DisabledCookie(configAuth.TokenName, httpsEnable).String())

	return &types.AnyResp{
		Data: &map[string]interface{}{
			"redirectUrl": s.svcCtx.Config.Auth.LogoutRedirectUrl,
		},
	}, nil
}

func (g *gatewayService) ExecGQL(request *types.ExecGQLParams) (*types.AnyResp, error) {
	authData := g.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	client, err := nebula.GetClient(authData.ClientID)
	if err != nil {
		return nil, err
	}
	nebulaClient, err := client.GetNebulaClient()
	defer client.ReleaseNebulaClient(nebulaClient)
	if err != nil {
		return nil, ecode.WithErrorMessage(ecode.ErrNoClient, err, "get nebula client failed")
	}

	// Use request timeout if provided, otherwise use client's default timeout
	timeout := request.Timeout

	resp, err := graphd.RunGqlWithTimeout(*nebulaClient, request.Gql, timeout)
	if err != nil {
		return nil, ecode.WithErrorMessage(ecode.ErrInternalServer, err, "run gql failed")
	}
	return &types.AnyResp{Data: response.StandardHandlerDataFieldAny(resp)}, nil
}

func (s *gatewayService) GetUserInfo() (*types.UserInfo, error) {
	authData, ok := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	if !ok {
		return nil, ecode.WithUnauthorized(fmt.Errorf("get auth data failed"))
	}
	client, err := nebula.GetClient(authData.ClientID)
	if err != nil {
		return nil, err
	}
	return &types.UserInfo{
		Username:      authData.Username,
		Address:       authData.Address,
		CoreVersion:   authData.CoreVersion,
		Version:       authData.Version,
		CurSchemaPath: client.CurSchemaPath,
	}, nil
}

func (s *gatewayService) ChangeSchema(request *types.ChangeSchemaParams) (*types.AnyResp, error) {
	authData := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	nebula.RemoveClient(authData.ClientID)
	var client *nebula.Client
	var err error
	if authData.OAuth2SessionID != "" {
		client, err = nebula.NewOAuth2Client(authData.Address, authData.Username, authData.Token, authData.OAuth2ServerName, request.SchemaPath, 0)
	} else {
		client, err = nebula.NewClient(authData.Address, authData.Username, authData.Password, authData.Token, request.SchemaPath, 0)
	}
	if err != nil || client == nil {
		return nil, err
	}
	client.PutToContainer(authData.ClientID)
	return &types.AnyResp{}, nil
}

func (s *gatewayService) ExecConsoleGQL(request *types.ExecGQLParams) (*types.AnyResp, error) {
	authData := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	nebulaClient, err := nebula.GetConsoleClient(authData.ClientID)
	var finNebulaClient nebulaTypes.Client
	if err == nil {
		finNebulaClient = *nebulaClient
	} else {
		client, err := nebula.GetClient(authData.ClientID)
		if err != nil {
			return nil, err
		}
		nebulaClient, err = client.GetNebulaClient()
		if err != nil {
			return nil, ecode.WithErrorMessage(ecode.ErrNoClient, err, "get nebula client failed")
		}
		finNebulaClient = *nebulaClient
		nebula.SetConsoleClient(authData.ClientID, nebulaClient)
	}

	// Use request timeout if provided, otherwise use client's default timeout
	timeout := request.Timeout

	resp, err := graphd.RunGqlWithTimeout(finNebulaClient, request.Gql, timeout)
	if err != nil {
		return nil, ecode.WithErrorMessage(ecode.ErrInternalServer, err, "run gql failed")
	}
	return &types.AnyResp{Data: response.StandardHandlerDataFieldAny(resp)}, nil
}

func (s *gatewayService) ImportData(req *types.ImportDataParams) (*types.AnyResp, error) {
	authData := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	client, err := nebula.GetClient(authData.ClientID)
	if err != nil {
		return nil, err
	}
	entries, err := dataset.DataFs.ReadDir(".")
	if err != nil {
		return nil, err
	}
	var found = false
	var filename string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		filename = entry.Name()
		if !strings.HasSuffix(filename, ".ngql") {
			continue
		}
		datasetName := strings.TrimSuffix(filename, ".ngql")

		if datasetName == req.DataSet {
			found = true
			break
		}
	}
	if !found {
		return nil, ecode.WithErrorMessage(ecode.ErrInternalDatabase, fmt.Errorf("Play file not found: %s", req.DataSet))
	}

	file, err := dataset.DataFs.Open(fmt.Sprintf("%s.ngql", req.DataSet))
	if err != nil {
		return nil, ecode.WithErrorMessage(ecode.ErrInternalDatabase, fmt.Errorf("Open %s.ngql failed, %s", req.DataSet, err.Error()))
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	c, err := client.GetNebulaClient()
	defer client.ReleaseNebulaClient(c)
	if err != nil {
		return nil, ecode.WithErrorMessage(ecode.ErrNoClient, fmt.Errorf("NewNebulaClient failed, %s", err.Error()))
	}
	if err := dataset.ExecuteFileDataImport(*c, scanner); err != nil {
		return nil, ecode.WithErrorMessage(ecode.ErrInternalDatabase, fmt.Errorf("prepareData failed, %s", err.Error()))
	}
	return &types.AnyResp{
		Data: "import data success",
	}, nil
}
