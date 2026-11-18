// Package studio provides the process entry point for Studio distributions.
package studio

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/vesoft-inc/go-pkg/middleware"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/handler"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	studioMiddleware "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/middleware"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/plugin"
	requestx "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/request"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/scheduler"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version"
	"github.com/zeromicro/go-zero/core/conf"
	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/rest"
	"gorm.io/gorm"
)

// Run starts Studio using its command-line arguments and blocks until shutdown.
// It uses process-wide services and should start only one server per process.
func Run(args []string) error {
	flags := flag.NewFlagSet("studio", flag.ContinueOnError)
	configFile := flags.String("f", "etc/config.yaml", "the config file")
	healthURL := flags.String("healthcheck", "", "check whether a Studio HTTP endpoint is healthy")
	printVersion := flags.Bool("v", false, "show version")
	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	if *printVersion {
		fmt.Println(version.NewVersion().String())
		return nil
	}
	if *healthURL != "" {
		return runHealthcheck(*healthURL)
	}
	var c config.Config
	if err := conf.Load(*configFile, &c, conf.UseEnv()); err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	if err := c.InitConfig(); err != nil {
		return fmt.Errorf("initialize config: %w", err)
	}

	if err := logx.SetUp(c.Log); err != nil {
		return fmt.Errorf("initialize logging: %w", err)
	}
	defer logx.Close()
	tokenSource, passphraseSource := config.AuthSecretSources()
	logx.Infof("authentication secrets initialized (token secret: %s, encryption passphrase: %s)", tokenSource, passphraseSource)

	var database *gorm.DB
	if c.Database.Enable {
		var err error
		database, err = db.InitDB(&c)
		if err != nil {
			return fmt.Errorf("initialize database: %w", err)
		}
	}

	svcCtx := svc.NewServiceContext(c, database)
	opts := []rest.RunOption{
		rest.WithNotFoundHandler(studioMiddleware.AssetsMiddlewareWithCtx(svcCtx)),
	}

	server, err := rest.NewServer(c.RestConf, opts...)
	if err != nil {
		return fmt.Errorf("initialize server: %w", err)
	}
	defer server.Stop()

	nebula.InitClientContainer()

	loadedPlugins, err := plugin.Load(c.Plugins, &pluginHost{svcCtx: svcCtx})
	if err != nil {
		return fmt.Errorf("load plugins: %w", err)
	}
	defer func() {
		if err := loadedPlugins.Close(); err != nil {
			logx.Errorf("close plugins: %v", err)
		}
	}()
	handler.RegisterHandlers(server, svcCtx)
	publicRoutes, err := registerPluginRoutes(server, loadedPlugins.Routes())
	if err != nil {
		return fmt.Errorf("register plugin routes: %w", err)
	}

	// global middleware
	server.Use(auth.AuthMiddlewareWithCtx(svcCtx, publicRoutes...))
	server.Use(rest.ToMiddleware(middleware.ReserveRequest(middleware.ReserveRequestConfig{
		Skipper: func(r *http.Request) bool {
			return requestx.IsLargeExplorerWrite(r)
		},
	})))
	server.Use(rest.ToMiddleware(middleware.ReserveResponseWriter(middleware.ReserveResponseWriterConfig{
		Skipper: func(r *http.Request) bool {
			return false
		},
	})))

	ctx, cancel := context.WithCancel(context.Background())
	var workers sync.WaitGroup
	workers.Go(func() { scheduler.Run(ctx) })
	defer func() {
		cancel()
		workers.Wait()
	}()

	fmt.Printf("Starting server at %s:%d...\n", c.Host, c.Port)
	return startServer(server)
}

func startServer(server *rest.Server) (err error) {
	// go-zero v1.7 panics with the error returned by its HTTP server.
	defer func() {
		switch cause := recover().(type) {
		case nil:
		case runtime.Error:
			panic(cause)
		case error:
			err = fmt.Errorf("start Studio HTTP server: %w", cause)
		default:
			panic(cause)
		}
	}()
	server.Start()
	return nil
}

func runHealthcheck(url string) error {
	client := &http.Client{
		Timeout: 3 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("Studio healthcheck failed: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("Studio healthcheck returned HTTP %d", response.StatusCode)
	}
	return nil
}
