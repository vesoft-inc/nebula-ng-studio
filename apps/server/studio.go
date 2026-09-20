package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/vesoft-inc/go-pkg/middleware"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/handler"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	studioMiddleware "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/middleware"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	requestx "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/request"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/scheduler"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version"
	"github.com/zeromicro/go-zero/core/conf"
	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/rest"
	"gorm.io/gorm"
)

var (
	configFile = flag.String("f", "etc/config.yaml", "the config file")
	healthURL  = flag.String("healthcheck", "", "check whether a Studio HTTP endpoint is healthy")
)

func main() {
	var printVersion bool
	flag.BoolVar(&printVersion, "v", false, "show version")

	flag.Parse()
	if printVersion {
		fmt.Println(version.NewVersion().String())
		return
	}
	if *healthURL != "" {
		if err := runHealthcheck(*healthURL); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	var c config.Config
	if err := conf.Load(*configFile, &c, conf.UseEnv()); err != nil {
		fmt.Fprintf(os.Stderr, "load config: %v\n", err)
		os.Exit(1)
	}
	if err := c.InitConfig(); err != nil {
		fmt.Fprintf(os.Stderr, "initialize config: %v\n", err)
		os.Exit(1)
	}

	logx.MustSetup(c.Log)
	defer logx.Close()
	tokenSource, passphraseSource := config.AuthSecretSources()
	logx.Infof("authentication secrets initialized (token secret: %s, encryption passphrase: %s)", tokenSource, passphraseSource)

	var database *gorm.DB
	if c.Database.Enable {
		var err error
		database, err = db.InitDB(&c)
		if err != nil {
			panic(fmt.Sprintf("initialize database: %v", err))
		}
	}

	svcCtx := svc.NewServiceContext(c, database)
	opts := []rest.RunOption{
		rest.WithNotFoundHandler(studioMiddleware.AssetsMiddlewareWithCtx(svcCtx)),
	}

	server := rest.MustNewServer(c.RestConf, opts...)
	defer server.Stop()

	// global middleware
	server.Use(auth.AuthMiddlewareWithCtx(svcCtx))
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

	handler.RegisterHandlers(server, svcCtx)

	nebula.InitClientContainer()

	go scheduler.StartScheduler()

	fmt.Printf("Starting server at %s:%d...\n", c.Host, c.Port)
	server.Start()
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
