package oauth2auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"golang.org/x/oauth2"
)

type Config struct {
	Enable         bool
	ServerName     string
	AuthURL        string
	AccessTokenURL string
	ClientID       string
	ClientSecret   string
	RedirectURL    string
	UserInfoURL    string
	Scope          string
	UsernameField  string
}

func (c Config) OAuth2Config() *oauth2.Config {
	scopes := []string{}
	if c.Scope != "" {
		for _, s := range strings.Split(c.Scope, " ") {
			if s != "" {
				scopes = append(scopes, s)
			}
		}
	}

	return &oauth2.Config{
		ClientID:     c.ClientID,
		ClientSecret: c.ClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:   c.AuthURL,
			TokenURL:  c.AccessTokenURL,
			AuthStyle: oauth2.AuthStyleInParams,
		},
		RedirectURL: c.RedirectURL,
		Scopes:      scopes,
	}
}

func (c Config) UsesPKCE() bool {
	return c.ClientSecret == ""
}

func BuildAuthURL(c Config, state, verifier string) string {
	options := []oauth2.AuthCodeOption{}
	if c.UsesPKCE() {
		options = append(options,
			oauth2.SetAuthURLParam("code_challenge", GenerateCodeChallenge(verifier)),
			oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		)
	}
	return c.OAuth2Config().AuthCodeURL(state, options...)
}

func ExchangeCode(ctx context.Context, c Config, code, verifier string) (*oauth2.Token, error) {
	options := []oauth2.AuthCodeOption{}
	if c.UsesPKCE() {
		options = append(options, oauth2.VerifierOption(verifier))
	}
	return c.OAuth2Config().Exchange(ctx, code, options...)
}

func FetchUsername(ctx context.Context, c Config, token *oauth2.Token) (string, error) {
	userInfo, err := FetchUserInfo(ctx, c, token)
	if err != nil {
		return "", err
	}
	return ExtractUsername(userInfo, c.UsernameField)
}

func FetchUserInfo(ctx context.Context, c Config, token *oauth2.Token) (map[string]interface{}, error) {
	if c.UserInfoURL == "" {
		return nil, fmt.Errorf("UserInfoURL is not configured")
	}

	httpClient := c.OAuth2Config().Client(ctx, token)
	httpResp, err := httpClient.Get(c.UserInfoURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer httpResp.Body.Close()

	bodyBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read user info response: %w", err)
	}

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user info request failed with status %d", httpResp.StatusCode)
	}

	var userInfo map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info response: %w", err)
	}
	return userInfo, nil
}

func ExtractUsername(userInfo map[string]interface{}, usernameField string) (string, error) {
	username := ""
	if usernameField != "" {
		if value, ok := userInfo[usernameField].(string); ok && value != "" {
			username = value
		}
	}

	if username == "" {
		fieldPriority := []string{"preferred_username", "username", "login", "email", "sub"}
		for _, field := range fieldPriority {
			if value, ok := userInfo[field].(string); ok && value != "" {
				username = value
				break
			}
		}
	}

	if username == "" {
		return "", fmt.Errorf("could not extract username from user info response")
	}
	return username, nil
}

func GenerateRandomString(length int) (string, error) {
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func GenerateCodeChallenge(verifier string) string {
	s256 := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(s256[:])
}
