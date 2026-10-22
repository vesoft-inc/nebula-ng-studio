package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/zeromicro/go-zero/rest"
)

type Config struct {
	rest.RestConf
	BasePath    string `json:"basePath,optional"`
	DefaultHost string `json:"defaultHost,optional"`
	DefaultPort string `json:"defaultPort,optional"`
	Assets      Assets
	Auth        Auth
	SSO         SSO `json:",optional" yaml:"sso"`
	Database    Database
	Nebula      Nebula
}

type Assets struct {
	Gzip bool `json:",default=true"`
}

type SSO struct {
	Oauth2 Oauth2 `json:",optional" yaml:"oauth2"`
}

type Oauth2 struct {
	Enable         bool   `json:",optional" yaml:"enable"`
	ServerName     string `json:",optional" yaml:"serverName"`
	AuthURL        string `json:",optional" yaml:"authURL"`
	AccessTokenURL string `json:",optional" yaml:"accessTokenURL"`
	ClientID       string `json:",optional" yaml:"clientID"`
	ClientSecret   string `json:",optional" yaml:"clientSecret"`
	RedirectURL    string `json:",optional" yaml:"redirectURL"`
	UserInfoURL    string `json:",optional" yaml:"userInfoURL"`
	Scope          string `json:",optional" yaml:"scope"`
	UsernameField  string `json:",optional" yaml:"usernameField"`
}

type Database struct {
	Enable bool `json:",default=true"`

	// mysql, sqlite3
	Dialect     string
	AutoMigrate bool `json:",default=true"`
	// Silent(1), Error(2), Warn(3), Info(4)
	LogLevel int `json:",default=4"`
	// sqlite config
	SqliteFilePath string `json:",default=data/studio.db"`

	// mysql config
	Host     string            `json:",optional"`
	Port     int               `json:",optional"`
	Username string            `json:",optional"`
	Password string            `json:",optional"`
	Name     string            `json:",optional"` // database name
	Params   map[string]string `json:"-"`
}

type Auth struct {
	TokenName          string
	TokenIssuer        string `json:",optional"`
	TokenSecret        string `json:",optional"`
	EncryptPassphrase  string `json:",optional"`
	TokenMaxAge        int64
	LogoutRedirectUrl  string `json:",optional"`
	Ca                 string `json:",optional"`
	CertFile           string `json:",optional"`
	KeyFile            string `json:",optional"`
	InsecureSkipVerify bool   `json:",default=false"`
}

type Nebula struct {
	ClientMaxNum           int `json:",default=200"`
	ClientPoolConnsMaxOpen int `json:",default=100"`
	ClientPoolConnsMinOpen int `json:",default=1"`
	ClientPoolMaxWait      int `json:",default=10"`
	ClientMaxIdleConns     int `json:",default=5"`
	ClientExpiredDuration  int `json:",default=14400"`
	ClientRequestTimeout   int `json:",default=10"`
}

const (
	defaultTokenIssuer   = "auth-service"
	tokenSecretEnv       = "STUDIO_TOKEN_SECRET"
	encryptPassphraseEnv = "STUDIO_ENCRYPT_PASSPHRASE"
)

var configIns *Config

type secretSource string

const (
	secretSourceEnvironment secretSource = "environment"
	secretSourceConfig      secretSource = "config"
	secretSourceGenerated   secretSource = "generated"
)

var tokenSecretSource, encryptPassphraseSource secretSource

func GetConfig() *Config {
	return configIns
}

// EffectiveTokenIssuer returns the configured JWT issuer or a neutral default.
func (a Auth) EffectiveTokenIssuer() string {
	issuer := strings.TrimSpace(a.TokenIssuer)
	if issuer == "" {
		return defaultTokenIssuer
	}
	return issuer
}

func (c *Config) Validate() error {
	switch len(c.Auth.EncryptPassphrase) {
	case 16, 24, 32:
		return nil
	default:
		return fmt.Errorf("Auth.EncryptPassphrase must be 16, 24, or 32 bytes")
	}
}

func randomURLSafeString(byteLength int) (string, error) {
	randomBytes := make([]byte, byteLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("generate secure random value: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

func resolveSecret(configValue, environmentName string, generatedBytes int) (string, secretSource, error) {
	if environmentValue, ok := os.LookupEnv(environmentName); ok {
		if environmentValue == "" {
			return "", "", fmt.Errorf("%s must not be empty when set", environmentName)
		}
		return environmentValue, secretSourceEnvironment, nil
	}
	if configValue != "" {
		return configValue, secretSourceConfig, nil
	}
	generated, err := randomURLSafeString(generatedBytes)
	if err != nil {
		return "", "", err
	}
	return generated, secretSourceGenerated, nil
}

func (c *Config) completeAuth() error {
	var err error
	c.Auth.TokenSecret, tokenSecretSource, err = resolveSecret(c.Auth.TokenSecret, tokenSecretEnv, 32)
	if err != nil {
		return err
	}

	// Encoding 24 random bytes as raw URL-safe base64 produces exactly 32 ASCII bytes.
	c.Auth.EncryptPassphrase, encryptPassphraseSource, err = resolveSecret(
		c.Auth.EncryptPassphrase,
		encryptPassphraseEnv,
		24,
	)
	if err != nil {
		return err
	}

	c.Auth.TokenIssuer = c.Auth.EffectiveTokenIssuer()
	if strings.Contains(c.Auth.TokenIssuer, c.Auth.TokenSecret) {
		return fmt.Errorf("Auth.TokenIssuer must not contain Auth.TokenSecret")
	}
	return nil
}

func (c *Config) Complete() error {
	if c.Database.Dialect == "sqlite3" {
		if c.Database.SqliteFilePath == "" {
			c.Database.SqliteFilePath = "data/default.db"
		}
		abs, err := filepath.Abs(c.Database.SqliteFilePath)
		if err != nil {
			return fmt.Errorf("resolve sqlite database path: %w", err)
		}

		if _, err := os.Stat(abs); os.IsNotExist(err) {
			if _, err := os.Stat(filepath.Dir(abs)); os.IsNotExist(err) {
				if err := os.MkdirAll(filepath.Dir(abs), os.ModePerm); err != nil {
					return fmt.Errorf("create sqlite database directory: %w", err)
				}
			}
			if err := os.WriteFile(abs, []byte(""), os.ModePerm); err != nil {
				return fmt.Errorf("create sqlite database file: %w", err)
			}
		}
	}
	return nil
}

func (c *Config) InitConfig() error {
	if err := c.completeAuth(); err != nil {
		return err
	}
	if err := c.Validate(); err != nil {
		return err
	}
	if err := c.Complete(); err != nil {
		return err
	}
	configIns = c
	return nil
}

func AuthSecretSources() (string, string) {
	return string(tokenSecretSource), string(encryptPassphraseSource)
}

func (c *Config) IsEnableNebulaTLS() bool {
	return c.Auth.Ca != ""
}
