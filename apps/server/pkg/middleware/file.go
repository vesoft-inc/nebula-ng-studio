package utils

import (
	"bytes"
	"compress/gzip"
	"html/template"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/klauspost/compress/gzhttp"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"github.com/zeromicro/go-zero/core/logx"
)

const (
	assetsRoot = "assets/public"
	indexFile  = "index.html"
)

func ValidateAuthCookie(r *http.Request, config *config.Config) (*auth.AuthData, error) {
	tokenCookie, err := r.Cookie(config.Auth.TokenName)
	if err != nil {
		return nil, err
	}
	authInfo, err := auth.Decode(tokenCookie.Value, config.Auth.TokenSecret, config.Auth.EncryptPassphrase)
	if err != nil {
		return nil, err
	}

	return authInfo, nil
}

func AssetsMiddlewareWithCtx(svcCtx *svc.ServiceContext) http.Handler {
	indexPath := filepath.Join(assetsRoot, indexFile)
	if _, err := os.Stat(indexPath); err != nil {
		logx.Errorf("Studio frontend assets are unavailable at %s: %v", indexPath, err)
	}

	frontendHandler := http.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath, withinBasePath := frontendPath(r.URL.Path, svcCtx.Config.BasePath)
		if withinBasePath && urlPath != "/" && urlPath != "/index.html" {
			if serveAsset(w, r, urlPath) {
				return
			}
			if path.Ext(urlPath) != "" {
				http.NotFound(w, r)
				return
			}
		}

		serveIndex(w, r, svcCtx)
	}))
	if svcCtx.Config.Assets.Gzip {
		wrapper, err := gzhttp.NewWrapper(
			gzhttp.CompressionLevel(gzip.BestSpeed),
			gzhttp.MinSize(1024),
		)
		if err != nil {
			panic(err)
		}
		frontendHandler = wrapper(frontendHandler)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logx.WithContext(r.Context())

		urlPath := r.URL.Path
		frontendURLPath, _ := frontendPath(urlPath, svcCtx.Config.BasePath)
		if strings.HasPrefix(urlPath, "/api-") || strings.HasPrefix(frontendURLPath, "/api-") {
			http.NotFound(w, r)
			return
		}
		if filepath.Ext(urlPath) == "" && !strings.HasPrefix(r.URL.Path, path.Join(svcCtx.Config.BasePath, "/login")) {
			_, err := ValidateAuthCookie(r, &svcCtx.Config)
			if err != nil {
				// protocol := "http"
				// if r.TLS != nil {
				// 	protocol = "https"
				// }
				redirectUrl := path.Join(svcCtx.Config.BasePath, "/login")
				if svcCtx.Config.Auth.LogoutRedirectUrl != "" {
					redirectUrl = "/"
					logger.Infof("login with error: %v, redirect to %s", err, redirectUrl)
					http.Redirect(w, r, redirectUrl, http.StatusFound)
					return
				}
				logger.Infof("login with error: %v, redirect to %s", err, redirectUrl)
				http.Redirect(w, r, redirectUrl, http.StatusFound)
				return
			}
		}

		frontendHandler.ServeHTTP(w, r)
	})
}

func frontendPath(requestPath, basePath string) (string, bool) {
	cleanRequestPath := path.Clean("/" + requestPath)
	cleanBasePath := path.Clean("/" + basePath)
	if cleanBasePath == "/" {
		return cleanRequestPath, true
	}
	if cleanRequestPath == cleanBasePath {
		return "/", true
	}
	if strings.HasPrefix(cleanRequestPath, cleanBasePath+"/") {
		return strings.TrimPrefix(cleanRequestPath, cleanBasePath), true
	}
	return cleanRequestPath, false
}

func serveAsset(w http.ResponseWriter, r *http.Request, urlPath string) bool {
	file, err := http.Dir(assetsRoot).Open(urlPath)
	if err != nil {
		return false
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil || stat.IsDir() {
		return false
	}

	if strings.EqualFold(path.Ext(urlPath), ".html") {
		setHTMLNoCacheHeaders(w.Header())
	} else if strings.HasPrefix(urlPath, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
	return true
}

func serveIndex(w http.ResponseWriter, r *http.Request, svcCtx *svc.ServiceContext) {
	tpl, err := template.ParseFiles(filepath.Join(assetsRoot, indexFile))
	if err != nil {
		if os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
		withErrorMessage := utils.ErrMsgWithLogger(r.Context())
		svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrInternalServer, err))
		return
	}

	var body bytes.Buffer
	if err := tpl.Execute(&body, map[string]any{
		"basePath":    svcCtx.Config.BasePath,
		"defaultHost": svcCtx.Config.DefaultHost,
		"defaultPort": svcCtx.Config.DefaultPort,
	}); err != nil {
		withErrorMessage := utils.ErrMsgWithLogger(r.Context())
		svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrInternalServer, err))
		return
	}

	setHTMLNoCacheHeaders(w.Header())
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body.Bytes())
}

func setHTMLNoCacheHeaders(header http.Header) {
	header.Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	header.Set("Expires", time.Unix(0, 0).UTC().Format(http.TimeFormat))
	header.Set("Surrogate-Control", "no-store")
}
