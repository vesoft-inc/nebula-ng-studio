package studio

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/plugin"
	pluginauth "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/plugin/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version"
	"github.com/zeromicro/go-zero/core/search"
	"github.com/zeromicro/go-zero/rest"
	"github.com/zeromicro/go-zero/rest/router"
)

type pluginHost struct {
	svcCtx *svc.ServiceContext
}

func (host *pluginHost) Respond(w http.ResponseWriter, r *http.Request, data any, err error) {
	host.svcCtx.ResponseHandler.Handle(w, r, data, err)
}

func (host *pluginHost) Auth() pluginauth.Service { return host }

func (host *pluginHost) OpenSession(ctx context.Context, params pluginauth.ConnectParams) (pluginauth.Session, error) {
	return openPluginSession(ctx, &host.svcCtx.Config, params, defaultPluginSessionDependencies())
}

func (host *pluginHost) CookieConfig() pluginauth.CookieConfig {
	return pluginauth.CookieConfig{
		Name:   host.svcCtx.Config.Auth.TokenName,
		MaxAge: host.svcCtx.Config.Auth.TokenMaxAge,
	}
}

// openPluginSession owns client creation through signing, using the existing
// container and token format. Driver calls retain their configured timeouts;
// cancellation is checked between stages and before handing off the session.
func openPluginSession(ctx context.Context, cfg *config.Config, params pluginauth.ConnectParams, deps pluginSessionDependencies) (pluginauth.Session, error) {
	if err := ctx.Err(); err != nil {
		return pluginauth.Session{}, err
	}
	if strings.TrimSpace(params.Address) == "" || strings.TrimSpace(params.Username) == "" {
		return pluginauth.Session{}, errors.New("database address and username are required")
	}
	credentials := params.Credentials
	if (credentials.Password == nil) == (credentials.GraphdToken == nil) {
		return pluginauth.Session{}, errors.New("select exactly one database credential: password or Graphd token")
	}

	var password, graphdToken, coreVersion string
	var err error
	if credentials.GraphdToken != nil {
		graphdToken = *credentials.GraphdToken
		if graphdToken == "" {
			return pluginauth.Session{}, errors.New("Graphd token must not be empty")
		}
		coreVersion, err = deps.pingToken(params.Address, params.Username, graphdToken)
	} else {
		password = *credentials.Password
		coreVersion, err = deps.pingPassword(params.Address, params.Username, password)
	}
	if err != nil {
		return pluginauth.Session{}, err
	}
	if err := ctx.Err(); err != nil {
		return pluginauth.Session{}, err
	}
	client, err := deps.newClient(params.Address, params.Username, password, graphdToken, params.DefaultSchema, 0)
	if err != nil {
		return pluginauth.Session{}, err
	}
	if client == nil {
		return pluginauth.Session{}, errors.New("graph database client is nil")
	}
	stored := false
	defer func() {
		if !stored {
			deps.closeClient(client)
		}
	}()
	if err := ctx.Err(); err != nil {
		return pluginauth.Session{}, err
	}
	token, err := deps.createToken(&auth.AuthData{
		Address:     params.Address,
		Username:    params.Username,
		Password:    password,
		ClientID:    client.ID,
		CoreVersion: coreVersion,
		Version:     version.Value,
		Token:       graphdToken,
	}, cfg)
	if err != nil {
		return pluginauth.Session{}, err
	}
	if err := ctx.Err(); err != nil {
		return pluginauth.Session{}, err
	}
	// Publishing may evict an existing session. Only a successful login gets a slot.
	deps.storeClient(client)
	stored = true
	return pluginauth.Session{Token: token}, nil
}

type pluginSessionDependencies struct {
	pingPassword func(address, username, password string) (string, error)
	pingToken    func(address, username, token string) (string, error)
	newClient    func(address, username, password, token, schemaPath string, timeoutSeconds int) (*nebula.Client, error)
	storeClient  func(*nebula.Client)
	closeClient  func(*nebula.Client)
	createToken  func(*auth.AuthData, *config.Config) (string, error)
}

func defaultPluginSessionDependencies() pluginSessionDependencies {
	return pluginSessionDependencies{
		pingPassword: nebula.PingWithClientInfo,
		pingToken:    nebula.PingWithTokenClientInfo,
		newClient:    nebula.NewClient,
		storeClient:  func(client *nebula.Client) { client.PutToContainer(client.ID) },
		closeClient:  func(client *nebula.Client) { client.GetPool().Close() },
		createToken:  auth.CreateToken,
	}
}

// Validate the complete route set before mounting any plugin endpoint or
// granting public access. Use the host router's rules, including existing routes.
func registerPluginRoutes(server *rest.Server, routes []plugin.Route) ([]rest.Route, error) {
	if len(routes) == 0 {
		return nil, nil
	}
	checker := router.NewRouter()
	for _, route := range server.Routes() {
		if err := checker.Handle(route.Method, pluginRoutePattern(route.Path), route.Handler); err != nil {
			return nil, fmt.Errorf("existing route %s %s: %w", route.Method, route.Path, err)
		}
	}
	var registered, public []rest.Route
	for _, route := range routes {
		if route.Handler == nil {
			return nil, fmt.Errorf("plugin route %s %s has no handler", route.Method, route.Path)
		}
		if route.Public && (path.Clean(route.Path) != route.Path || strings.Contains(route.Path, "/:")) {
			return nil, fmt.Errorf("public plugin route %s %s must use a canonical literal path", route.Method, route.Path)
		}
		if err := checker.Handle(route.Method, pluginRoutePattern(route.Path), route.Handler); err != nil {
			return nil, fmt.Errorf("plugin route %s %s: %w", route.Method, route.Path, err)
		}
		if !route.Public {
			// Built-in exemptions match paths regardless of method. A private
			// plugin endpoint must never inherit one, including via parameters.
			pattern := search.NewTree()
			if err := pattern.Add(path.Clean(route.Path), true); err != nil {
				return nil, err
			}
			for _, publicPath := range auth.NoApiAuthRoutes {
				if _, matches := pattern.Search(publicPath); matches {
					return nil, fmt.Errorf("protected plugin route %s %s overlaps built-in public path %s", route.Method, route.Path, publicPath)
				}
			}
		}
		registered = append(registered, rest.Route{Method: route.Method, Path: route.Path, Handler: route.Handler})
		if route.Public {
			public = append(public, rest.Route{Method: route.Method, Path: route.Path})
		}
	}
	if len(registered) > 0 {
		server.AddRoutes(registered)
	}
	return public, nil
}

// Parameter names do not distinguish endpoints: /items/:id and /items/:name
// must conflict even though go-zero stores them as separate patterns.
func pluginRoutePattern(routePath string) string {
	segments := strings.Split(path.Clean(routePath), "/")
	for i, segment := range segments {
		if strings.HasPrefix(segment, ":") {
			segments[i] = ":param"
		}
	}
	return strings.Join(segments, "/")
}
