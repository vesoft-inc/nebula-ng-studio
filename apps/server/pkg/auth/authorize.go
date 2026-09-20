package auth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/oauth2auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	commonutils "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version"
	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/rest"
)

type (
	CtxKeyUserInfo struct{}

	AuthData struct {
		Address          string `json:"address"`
		Username         string `json:"username"`
		Password         string `json:"password"`
		ClientID         string `json:"clientId"`
		CoreVersion      string `json:"coreVersion"`
		Version          string `json:"version"`
		Token            string `json:"token"` // token is used for OAuth2 authentication
		OAuth2SessionID  string `json:"oauth2SessionID,omitempty"`
		OAuth2ServerName string `json:"oauth2ServerName,omitempty"`
	}

	authClaims struct {
		EncryptedAuthData string
		jwt.RegisteredClaims
	}
)

var CtxUserInfoMap map[string]AuthData = make(map[string]AuthData)

// set the timeout for the graph service: 8 hours
// once the timeout is reached, the connection will be closed
// all requests running ngql will be failed, so keepping a long timeout is necessary, make the connection alive
const GraphServiceTimeout = 8 * time.Hour

var NoApiAuthRoutes = []string{
	"/api-studio/health",
	"/api-studio/health/ready",
	"/api-studio/db/connect",
	"/api-studio/db/oauth2-config",
	"/api-studio/db/oauth2-connect",
	"/api-studio/db/oauth2-callback",
}

func IsSessionError(err error) bool {
	subErrMsgStr := []string{
		"session expired",
		"connection refused",
		"broken pipe",
		"an existing connection was forcibly closed",
		"Token is expired",
		"Session not existed",
	}
	for _, subErrMsg := range subErrMsgStr {
		if strings.Contains(err.Error(), subErrMsg) {
			return true
		}
	}
	return false
}

func Encrypt(data []byte, passphrase string) (string, error) {
	block, err := aes.NewCipher([]byte(passphrase))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(encrypted string, passphrase string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher([]byte(passphrase))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func CreateToken(authData *AuthData, config *config.Config) (string, error) {
	now := time.Now()
	expiresAt := now.Add(time.Duration(config.Auth.TokenMaxAge) * time.Second).Unix()
	authDataBytes, err := json.Marshal(authData)
	if err != nil {
		return "", err
	}
	encryptedAuthData, err := Encrypt(authDataBytes, config.Auth.EncryptPassphrase)
	if err != nil {
		return "", err
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256,
		authClaims{
			EncryptedAuthData: encryptedAuthData,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: &jwt.NumericDate{Time: time.Unix(expiresAt, 0)},
				Issuer:    config.Auth.TokenSecret,
			},
		})
	return token.SignedString([]byte(config.Auth.TokenSecret))
}

func ParseConnectDBParams(params *types.ConnectDBParams, config *config.Config) (string, error) {
	tokenSplit := strings.Split(params.Authorization, " ")
	if len(tokenSplit) != 2 {
		return "", fmt.Errorf("invalid authorization")
	}

	decode, err := commonutils.Sm4Decrypt(tokenSplit[1], "")
	if err != nil {
		return "", err
	}

	loginInfo := []string{}
	err = json.Unmarshal(decode, &loginInfo)

	if err != nil {
		return "", err
	}

	if len(loginInfo) < 2 {
		return "", fmt.Errorf("len of account is less than two")
	}

	username, password := loginInfo[0], loginInfo[1]
	coreVersion, err := nebula.PingWithClientInfo(params.Address, username, password)
	if err != nil {
		return "", err
	}
	client, err := nebula.NewClient(params.Address, username, password, "", params.DefaultSchema, 0)
	if err != nil || client == nil {
		return "", err
	}
	client.PutToContainer(client.ID)
	tokenString, err := CreateToken(
		&AuthData{
			Address:     params.Address,
			Username:    username,
			Password:    password,
			ClientID:    client.ID,
			CoreVersion: coreVersion,
			Version:     version.Value,
			Token:       "",
		},
		config,
	)
	return tokenString, err
}

func AuthMiddlewareWithCtx(svcCtx *svc.ServiceContext) rest.Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if isNoAPIAuthRoute(r.URL.Path) {
				next(w, r)
				return
			}

			tokenCookie, tokenErr := r.Cookie(svcCtx.Config.Auth.TokenName)
			withErrorMessage := utils.ErrMsgWithLogger(r.Context())
			if tokenErr != nil {
				svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, tokenErr))
				return
			}

			auth, authErr := Decode(tokenCookie.Value, svcCtx.Config.Auth.TokenSecret, svcCtx.Config.Auth.EncryptPassphrase)
			if authErr != nil {
				svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, authErr))
				return
			}
			if auth.ClientID == "" {
				svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, errors.New("session id is empty")))
				return
			}
			updatedOAuth2Session := false
			accessTokenChanged := false
			if auth.OAuth2SessionID != "" {
				session, exists := oauth2auth.GetTokenSessionStore().Get(auth.OAuth2SessionID)
				if !exists {
					svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, errors.New("session expired")))
					return
				}
				auth.Token = session.AccessToken
				if session.ServerName != "" {
					auth.OAuth2ServerName = session.ServerName
				}
				oldAccessToken := auth.Token
				var err error
				updatedOAuth2Session, err = RefreshOAuth2TokenIfNeeded(&svcCtx.Config, auth, session)
				if err != nil {
					oauth2auth.GetTokenSessionStore().Delete(auth.OAuth2SessionID)
					svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, err))
					return
				}
				accessTokenChanged = auth.Token != oldAccessToken
			}
			client, err := nebula.GetClient(auth.ClientID)
			if err != nil {
				svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrNoClient, err))
				return
			} else if client.IsExpired() {
				nebula.RemoveClient(auth.ClientID)
				svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, errors.New("session expired")))
				return
			} else if accessTokenChanged {
				client, err = recreateOAuth2Client(auth)
				if err != nil {
					nebula.RemoveClient(auth.ClientID)
					svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, err))
					return
				}
			} else if err := nebula.PingClient(client); err != nil {
				nebula.RemoveClient(auth.ClientID)
				svcCtx.ResponseHandler.Handle(w, r, nil, withErrorMessage(ecode.ErrSession, err))
				return
			}
			if updatedOAuth2Session {
				if err := setRefreshedOAuth2AuthCookie(w, svcCtx.Config, auth); err != nil {
					logx.Errorf("failed to create refreshed oauth2 auth cookie: %v", err)
				}
			}
			// Add auth to request context.
			//
			// Get auth from context:
			// auth := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
			r = r.WithContext(context.WithValue(r.Context(), CtxKeyUserInfo{}, auth))

			next(w, r)
		}
	}
}

func isNoAPIAuthRoute(path string) bool {
	for _, route := range NoApiAuthRoutes {
		if path == route {
			return true
		}
	}
	return false
}

func RefreshOAuth2TokenIfNeeded(cfg *config.Config, authData *AuthData, session *oauth2auth.TokenSession) (bool, error) {
	if !cfg.SSO.Oauth2.Enable || authData.OAuth2SessionID == "" {
		return false, nil
	}

	now := time.Now().Unix()
	if session.RefreshToken == "" {
		if session.Expiry > 0 && now >= session.Expiry-60 {
			return false, fmt.Errorf("token expired and refresh token is unavailable")
		}
		return false, nil
	}
	if session.AccessToken != "" && session.Expiry > 0 && now < session.Expiry-60 {
		return false, nil
	}

	merged, err := oauth2auth.EnsureFreshToken(context.Background(), studioOAuth2Config(*cfg), session, time.Minute)
	if err != nil {
		return false, fmt.Errorf("failed to refresh token: %w", err)
	}

	authData.Token = merged.AccessToken
	if merged.SessionChanged {
		if ok := oauth2auth.GetTokenSessionStore().Update(authData.OAuth2SessionID, merged.AccessToken, merged.RefreshToken, merged.Expiry); !ok {
			return false, fmt.Errorf("oauth2 session expired")
		}
	}
	return merged.SessionChanged, nil
}

func studioOAuth2Config(c config.Config) oauth2auth.Config {
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

func setRefreshedOAuth2AuthCookie(w http.ResponseWriter, cfg config.Config, authData *AuthData) error {
	tokenAuthData := *authData
	tokenAuthData.Token = ""
	tokenString, err := CreateToken(&tokenAuthData, &cfg)
	if err != nil {
		return err
	}
	cookie := &http.Cookie{
		Name:     cfg.Auth.TokenName,
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   int(cfg.Auth.TokenMaxAge),
	}
	if cfg.CertFile != "" && cfg.KeyFile != "" {
		cookie.Secure = true
		cookie.SameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, cookie)
	return nil
}

func recreateOAuth2Client(authData *AuthData) (*nebula.Client, error) {
	oldClient, err := nebula.GetClient(authData.ClientID)
	if err != nil {
		return nil, err
	}
	client, err := nebula.NewOAuth2Client(authData.Address, authData.Username, authData.Token, authData.OAuth2ServerName, oldClient.CurSchemaPath, oldClient.Timeout)
	if err != nil {
		return nil, err
	}
	if err := nebula.PingClient(client); err != nil {
		client.GetPool().Close()
		return nil, err
	}
	nebula.RemoveClient(authData.ClientID)
	client.PutToContainer(authData.ClientID)
	return client, nil
}

func Decode(tokenString, secret string, passphrase string) (*AuthData, error) {
	claims := authClaims{}
	token, err := jwt.ParseWithClaims(tokenString, &claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	// Capturing signature invalid error in the situation of data tamper,
	// other validation errors are ignored
	if ve, ok := err.(*jwt.ValidationError); ok {
		if ve.Errors == jwt.ValidationErrorSignatureInvalid {
			return nil, errors.New("token signature validation failed")
		}
	}

	if _, ok := token.Claims.(*authClaims); !ok {
		return nil, errors.New("couldn't handle this token")
	}

	decryptedAuthData, err := Decrypt(claims.EncryptedAuthData, passphrase)
	if err != nil {
		return nil, err
	}

	var authData AuthData
	err = json.Unmarshal(decryptedAuthData, &authData)
	if err != nil {
		return nil, err
	}

	return &authData, nil
}
