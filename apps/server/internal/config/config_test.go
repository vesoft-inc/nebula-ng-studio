package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zeromicro/go-zero/core/conf"
)

func TestReleaseConfigKeepsOAuth2DisabledWithoutProviderPreset(t *testing.T) {
	var c Config
	if err := conf.Load("../../etc/config-release.yaml", &c, conf.UseEnv()); err != nil {
		t.Fatalf("load release config: %v", err)
	}

	if c.SSO.Oauth2.Enable {
		t.Fatal("expected OAuth2 SSO to be disabled by default")
	}
	if got, want := c.SSO.Oauth2.Scope, "openid profile email"; got != want {
		t.Fatalf("expected scope %q, got %q", want, got)
	}
	if c.SSO.Oauth2.AuthURL != "" || c.SSO.Oauth2.AccessTokenURL != "" || c.SSO.Oauth2.UserInfoURL != "" || c.SSO.Oauth2.RedirectURL != "" {
		t.Fatal("expected release config to contain no OAuth2 provider preset")
	}
	if c.DefaultHost != "" {
		t.Fatalf("expected default host to be empty, got %q", c.DefaultHost)
	}
	if c.DefaultPort != "" {
		t.Fatalf("expected default port to be empty, got %q", c.DefaultPort)
	}
}

func TestDefaultLoginValuesCanBeConfigured(t *testing.T) {
	contents, err := os.ReadFile("../../etc/config-release.yaml")
	if err != nil {
		t.Fatalf("read release config: %v", err)
	}
	contents = []byte(strings.Replace(string(contents), `DefaultHost: ''`, `DefaultHost: 'graph0'`, 1))
	contents = []byte(strings.Replace(string(contents), `DefaultPort: ''`, `DefaultPort: '9669'`, 1))
	configPath := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(configPath, contents, 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	var c Config
	if err := conf.Load(configPath, &c); err != nil {
		t.Fatalf("load config: %v", err)
	}
	if got, want := c.DefaultHost, "graph0"; got != want {
		t.Fatalf("expected default host %q, got %q", want, got)
	}
	if got, want := c.DefaultPort, "9669"; got != want {
		t.Fatalf("expected default port %q, got %q", want, got)
	}
}
