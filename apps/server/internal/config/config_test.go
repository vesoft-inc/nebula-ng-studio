package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zeromicro/go-zero/core/conf"
)

func TestReleaseConfigKeepsOAuth2DisabledWithoutProviderPreset(t *testing.T) {
	unsetEnvForTest(t, "STUDIO_GRAPHD_DEFAULT_HOST")
	unsetEnvForTest(t, "STUDIO_GRAPHD_DEFAULT_PORT")

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

func TestBundledGraphdDefaultsExpandEnvironment(t *testing.T) {
	configPaths := map[string]string{
		"development": "../../etc/config.yaml",
		"release":     "../../etc/config-release.yaml",
		"package":     "../../etc/config-package.yaml",
	}
	cases := []struct {
		name string
		host string
		port string
	}{
		{name: "both", host: "graph0", port: "19669"},
		{name: "host only", host: "graph0"},
		{name: "port only", port: "19669"},
		{name: "unset"},
	}

	for configName, configPath := range configPaths {
		t.Run(configName, func(t *testing.T) {
			for _, tc := range cases {
				t.Run(tc.name, func(t *testing.T) {
					unsetEnvForTest(t, "STUDIO_GRAPHD_DEFAULT_HOST")
					unsetEnvForTest(t, "STUDIO_GRAPHD_DEFAULT_PORT")
					if tc.host != "" {
						t.Setenv("STUDIO_GRAPHD_DEFAULT_HOST", tc.host)
					}
					if tc.port != "" {
						t.Setenv("STUDIO_GRAPHD_DEFAULT_PORT", tc.port)
					}

					var c Config
					if err := conf.Load(configPath, &c, conf.UseEnv()); err != nil {
						t.Fatalf("load config: %v", err)
					}
					if c.DefaultHost != tc.host {
						t.Errorf("expected default host %q, got %q", tc.host, c.DefaultHost)
					}
					if c.DefaultPort != tc.port {
						t.Errorf("expected default port %q, got %q", tc.port, c.DefaultPort)
					}
				})
			}
		})
	}
}

func TestLiteralGraphdDefaultsIgnoreEnvironment(t *testing.T) {
	contents, err := os.ReadFile("../../etc/config-release.yaml")
	if err != nil {
		t.Fatalf("read release config: %v", err)
	}
	contents = []byte(strings.Replace(string(contents), `DefaultHost: '${STUDIO_GRAPHD_DEFAULT_HOST}'`, `DefaultHost: 'graph0'`, 1))
	contents = []byte(strings.Replace(string(contents), `DefaultPort: '${STUDIO_GRAPHD_DEFAULT_PORT}'`, `DefaultPort: '9669'`, 1))
	configPath := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(configPath, contents, 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	t.Setenv("STUDIO_GRAPHD_DEFAULT_HOST", "ignored-host")
	t.Setenv("STUDIO_GRAPHD_DEFAULT_PORT", "19669")
	var c Config
	if err := conf.Load(configPath, &c, conf.UseEnv()); err != nil {
		t.Fatalf("load config: %v", err)
	}
	if got, want := c.DefaultHost, "graph0"; got != want {
		t.Fatalf("expected default host %q, got %q", want, got)
	}
	if got, want := c.DefaultPort, "9669"; got != want {
		t.Fatalf("expected default port %q, got %q", want, got)
	}
}

func unsetEnvForTest(t *testing.T, name string) {
	t.Helper()
	value, wasSet := os.LookupEnv(name)
	if err := os.Unsetenv(name); err != nil {
		t.Fatalf("unset %s: %v", name, err)
	}
	t.Cleanup(func() {
		var err error
		if wasSet {
			err = os.Setenv(name, value)
		} else {
			err = os.Unsetenv(name)
		}
		if err != nil {
			t.Errorf("restore %s: %v", name, err)
		}
	})
}
