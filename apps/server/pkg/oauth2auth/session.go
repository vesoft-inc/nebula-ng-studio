package oauth2auth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"
)

var ErrRefreshTokenRequired = errors.New("oauth2 refresh token is required")

type TokenSession struct {
	AccessToken  string
	RefreshToken string
	Expiry       int64
	ServerName   string
	CreatedAt    time.Time
}

type MergedToken struct {
	AccessToken        string
	RefreshToken       string
	Expiry             int64
	SessionChanged     bool
	AccessTokenChanged bool
}

type TokenSessionStore struct {
	sessions map[string]*TokenSession
	mutex    sync.RWMutex
	ttl      time.Duration
}

var (
	globalTokenSessionStore *TokenSessionStore
	tokenSessionStoreOnce   sync.Once
	refreshGroup            singleflight.Group
)

func NewTokenSessionStore(ttl time.Duration) *TokenSessionStore {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &TokenSessionStore{
		sessions: make(map[string]*TokenSession),
		ttl:      ttl,
	}
}

func GetTokenSessionStore() *TokenSessionStore {
	tokenSessionStoreOnce.Do(func() {
		globalTokenSessionStore = NewTokenSessionStore(24 * time.Hour)
		go globalTokenSessionStore.cleanupRoutine()
	})
	return globalTokenSessionStore
}

func (s *TokenSessionStore) Set(sessionID string, session *TokenSession) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	session.CreatedAt = time.Now()
	s.sessions[sessionID] = session
}

func (s *TokenSessionStore) SetToken(sessionID string, token *oauth2.Token, serverName string) {
	s.Set(sessionID, &TokenSession{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		Expiry:       token.Expiry.Unix(),
		ServerName:   serverName,
	})
}

func (s *TokenSessionStore) Get(sessionID string) (*TokenSession, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	session, exists := s.sessions[sessionID]
	if !exists {
		return nil, false
	}
	if time.Since(session.CreatedAt) > s.ttl {
		return nil, false
	}
	return session, true
}

func (s *TokenSessionStore) Update(sessionID, accessToken, refreshToken string, expiry int64) bool {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	session, exists := s.sessions[sessionID]
	if !exists {
		return false
	}
	session.AccessToken = accessToken
	session.RefreshToken = refreshToken
	session.Expiry = expiry
	session.CreatedAt = time.Now()
	return true
}

func (s *TokenSessionStore) Delete(sessionID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	delete(s.sessions, sessionID)
}

func (s *TokenSessionStore) Count() int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return len(s.sessions)
}

func MergeTokenSession(session *TokenSession, token *oauth2.Token) MergedToken {
	merged := MergedToken{}
	if session != nil {
		merged.AccessToken = session.AccessToken
		merged.RefreshToken = session.RefreshToken
		merged.Expiry = session.Expiry
	}
	if token == nil {
		return merged
	}

	if token.AccessToken != "" {
		merged.AccessToken = token.AccessToken
	}
	if token.RefreshToken != "" {
		merged.RefreshToken = token.RefreshToken
	}
	if !token.Expiry.IsZero() {
		merged.Expiry = token.Expiry.Unix()
	}

	if session == nil {
		merged.SessionChanged = merged.AccessToken != "" || merged.RefreshToken != "" || merged.Expiry != 0
		merged.AccessTokenChanged = merged.AccessToken != ""
		return merged
	}

	merged.AccessTokenChanged = merged.AccessToken != session.AccessToken
	merged.SessionChanged = merged.AccessTokenChanged || merged.RefreshToken != session.RefreshToken || merged.Expiry != session.Expiry
	return merged
}

func EnsureFreshToken(ctx context.Context, cfg Config, session *TokenSession, minTTL time.Duration) (MergedToken, error) {
	if session == nil {
		return MergedToken{}, fmt.Errorf("oauth2 token session is nil")
	}
	if minTTL < 0 {
		minTTL = 0
	}
	if session.AccessToken != "" && session.Expiry > 0 && time.Unix(session.Expiry, 0).After(time.Now().Add(minTTL)) {
		return MergeTokenSession(session, nil), nil
	}
	if session.RefreshToken == "" {
		return MergedToken{}, ErrRefreshTokenRequired
	}

	key := session.RefreshToken
	if key == "" {
		key = session.AccessToken
	}
	result, err, _ := refreshGroup.Do(key, func() (interface{}, error) {
		currentToken := &oauth2.Token{
			AccessToken:  session.AccessToken,
			RefreshToken: session.RefreshToken,
			Expiry:       time.Unix(session.Expiry, 0),
		}
		refreshSource := cfg.OAuth2Config().TokenSource(ctx, &oauth2.Token{
			RefreshToken: session.RefreshToken,
		})
		newToken, err := oauth2.ReuseTokenSourceWithExpiry(currentToken, refreshSource, minTTL).Token()
		if err != nil {
			return nil, err
		}
		return MergeTokenSession(session, newToken), nil
	})
	if err != nil {
		return MergedToken{}, err
	}
	merged, ok := result.(MergedToken)
	if !ok {
		return MergedToken{}, fmt.Errorf("unexpected oauth2 refresh result type %T", result)
	}
	return merged, nil
}

func (s *TokenSessionStore) cleanupRoutine() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		s.mutex.Lock()
		now := time.Now()
		for id, session := range s.sessions {
			if now.Sub(session.CreatedAt) > s.ttl {
				delete(s.sessions, id)
			}
		}
		s.mutex.Unlock()
	}
}
