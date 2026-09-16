package oauth2auth

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestMergeTokenSessionRefreshTokenOnly(t *testing.T) {
	session := &TokenSession{AccessToken: "access", RefreshToken: "refresh-old", Expiry: 100}
	merged := MergeTokenSession(session, &oauth2.Token{AccessToken: "access", RefreshToken: "refresh-new", Expiry: time.Unix(100, 0)})

	require.Equal(t, "access", merged.AccessToken)
	require.Equal(t, "refresh-new", merged.RefreshToken)
	require.Equal(t, int64(100), merged.Expiry)
	require.True(t, merged.SessionChanged)
	require.False(t, merged.AccessTokenChanged)
}

func TestMergeTokenSessionExpiryOnly(t *testing.T) {
	session := &TokenSession{AccessToken: "access", RefreshToken: "refresh", Expiry: 100}
	merged := MergeTokenSession(session, &oauth2.Token{AccessToken: "access", RefreshToken: "", Expiry: time.Unix(200, 0)})

	require.Equal(t, "access", merged.AccessToken)
	require.Equal(t, "refresh", merged.RefreshToken)
	require.Equal(t, int64(200), merged.Expiry)
	require.True(t, merged.SessionChanged)
	require.False(t, merged.AccessTokenChanged)
}

func TestMergeTokenSessionAccessTokenChanged(t *testing.T) {
	session := &TokenSession{AccessToken: "access-old", RefreshToken: "refresh", Expiry: 100}
	merged := MergeTokenSession(session, &oauth2.Token{AccessToken: "access-new", RefreshToken: "", Expiry: time.Unix(200, 0)})

	require.Equal(t, "access-new", merged.AccessToken)
	require.Equal(t, "refresh", merged.RefreshToken)
	require.Equal(t, int64(200), merged.Expiry)
	require.True(t, merged.SessionChanged)
	require.True(t, merged.AccessTokenChanged)
}

func TestMergeTokenSessionKeepsCurrentValuesForEmptyTokenFields(t *testing.T) {
	session := &TokenSession{AccessToken: "access", RefreshToken: "refresh", Expiry: 100}
	merged := MergeTokenSession(session, &oauth2.Token{})

	require.Equal(t, "access", merged.AccessToken)
	require.Equal(t, "refresh", merged.RefreshToken)
	require.Equal(t, int64(100), merged.Expiry)
	require.False(t, merged.SessionChanged)
	require.False(t, merged.AccessTokenChanged)
}

func TestEnsureFreshTokenReusesTokenWhenExpiryIsOutsideMinTTL(t *testing.T) {
	var refreshCalls int32

	session := &TokenSession{
		AccessToken:  "access-current",
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(16 * time.Minute).Unix(),
	}

	merged, err := EnsureFreshToken(context.Background(), Config{
		AccessTokenURL: "https://idp.example.test/token",
		ClientID:       "client-id",
		ClientSecret:   "client-secret",
	}, session, 15*time.Minute)

	require.NoError(t, err)
	require.Equal(t, "access-current", merged.AccessToken)
	require.Equal(t, "refresh-current", merged.RefreshToken)
	require.False(t, merged.SessionChanged)
	require.Equal(t, int32(0), atomic.LoadInt32(&refreshCalls))
}

func TestEnsureFreshTokenRefreshesTokenWhenExpiryIsInsideMinTTL(t *testing.T) {
	var refreshCalls int32
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			require.NoError(t, r.ParseForm())
			require.Equal(t, "refresh_token", r.Form.Get("grant_type"))
			require.Equal(t, "refresh-current", r.Form.Get("refresh_token"))
			atomic.AddInt32(&refreshCalls, 1)
			body, err := json.Marshal(map[string]interface{}{
				"access_token":  "access-refreshed",
				"refresh_token": "refresh-refreshed",
				"expires_in":    3600,
				"token_type":    "Bearer",
			})
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(bytes.NewReader(body)),
			}, nil
		}),
	})

	session := &TokenSession{
		AccessToken:  "access-current",
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(14 * time.Minute).Unix(),
	}

	merged, err := EnsureFreshToken(ctx, Config{
		AccessTokenURL: "https://idp.example.test/token",
		ClientID:       "client-id",
		ClientSecret:   "client-secret",
	}, session, 15*time.Minute)

	require.NoError(t, err)
	require.Equal(t, "access-refreshed", merged.AccessToken)
	require.Equal(t, "refresh-refreshed", merged.RefreshToken)
	require.True(t, merged.SessionChanged)
	require.True(t, merged.AccessTokenChanged)
	require.Greater(t, merged.Expiry, time.Now().Unix())
	require.Equal(t, int32(1), atomic.LoadInt32(&refreshCalls))
}

func TestEnsureFreshTokenRefreshesWhenAccessTokenIsEmpty(t *testing.T) {
	var refreshCalls int32
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			require.NoError(t, r.ParseForm())
			require.Equal(t, "refresh-current", r.Form.Get("refresh_token"))
			atomic.AddInt32(&refreshCalls, 1)
			body, err := json.Marshal(map[string]interface{}{
				"access_token":  "access-refreshed",
				"refresh_token": "refresh-current",
				"expires_in":    3600,
				"token_type":    "Bearer",
			})
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(bytes.NewReader(body)),
			}, nil
		}),
	})
	session := &TokenSession{
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(time.Hour).Unix(),
	}

	merged, err := EnsureFreshToken(ctx, Config{
		AccessTokenURL: "https://idp.example.test/token",
		ClientID:       "client-id",
		ClientSecret:   "client-secret",
	}, session, 15*time.Minute)

	require.NoError(t, err)
	require.Equal(t, "access-refreshed", merged.AccessToken)
	require.True(t, merged.SessionChanged)
	require.Equal(t, int32(1), atomic.LoadInt32(&refreshCalls))
}

func TestEnsureFreshTokenRequiresRefreshTokenWhenRefreshNeeded(t *testing.T) {
	session := &TokenSession{
		AccessToken: "access-current",
		Expiry:      time.Now().Add(14 * time.Minute).Unix(),
	}

	_, err := EnsureFreshToken(context.Background(), Config{}, session, 15*time.Minute)

	require.ErrorIs(t, err, ErrRefreshTokenRequired)
}

func TestTokenSessionStoreUpdateExtendsTTL(t *testing.T) {
	store := NewTokenSessionStore(200 * time.Millisecond)
	store.Set("session-active", &TokenSession{
		AccessToken:  "access-current",
		RefreshToken: "refresh-current",
		Expiry:       time.Now().Add(time.Hour).Unix(),
	})

	store.mutex.Lock()
	store.sessions["session-active"].CreatedAt = time.Now().Add(-190 * time.Millisecond)
	store.mutex.Unlock()

	require.True(t, store.Update(
		"session-active",
		"access-refreshed",
		"refresh-refreshed",
		time.Now().Add(time.Hour).Unix(),
	))

	time.Sleep(30 * time.Millisecond)
	session, ok := store.Get("session-active")
	require.True(t, ok)
	require.Equal(t, "access-refreshed", session.AccessToken)
	require.Equal(t, "refresh-refreshed", session.RefreshToken)
}
