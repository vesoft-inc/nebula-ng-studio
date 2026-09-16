package oauth2auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

const FlowCookieName = "oauth2_context"

type FlowContext struct {
	Verifier  string
	State     string
	Host      string
	Port      int
	CreatedAt time.Time
}

type FlowStore struct {
	flows map[string]*FlowContext
	mutex sync.RWMutex
	ttl   time.Duration
}

var (
	globalFlowStore *FlowStore
	flowStoreOnce   sync.Once
)

func NewFlowStore(ttl time.Duration) *FlowStore {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &FlowStore{
		flows: make(map[string]*FlowContext),
		ttl:   ttl,
	}
}

func GetFlowStore() *FlowStore {
	flowStoreOnce.Do(func() {
		globalFlowStore = NewFlowStore(5 * time.Minute)
		go globalFlowStore.cleanupRoutine()
	})
	return globalFlowStore
}

func (s *FlowStore) Set(flowID string, flow *FlowContext) error {
	if strings.TrimSpace(flowID) == "" {
		return errors.New("oauth2 flow id is empty")
	}
	if flow == nil {
		return errors.New("oauth2 flow is nil")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()
	flow.CreatedAt = time.Now()
	s.flows[flowID] = flow
	return nil
}

func (s *FlowStore) Consume(flowID string) (*FlowContext, bool) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	flow, exists := s.flows[flowID]
	if !exists {
		return nil, false
	}
	delete(s.flows, flowID)
	if time.Since(flow.CreatedAt) > s.ttl {
		return nil, false
	}
	return flow, true
}

func (s *FlowStore) Delete(flowID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	delete(s.flows, flowID)
}

func (s *FlowStore) cleanupRoutine() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.mutex.Lock()
		now := time.Now()
		for id, flow := range s.flows {
			if now.Sub(flow.CreatedAt) > s.ttl {
				delete(s.flows, id)
			}
		}
		s.mutex.Unlock()
	}
}

func SignFlowID(flowID, secret string) (string, error) {
	flowID = strings.TrimSpace(flowID)
	if flowID == "" {
		return "", errors.New("oauth2 flow id is empty")
	}
	if secret == "" {
		return "", errors.New("oauth2 flow signing secret is empty")
	}

	sig := signFlowID(flowID, secret)
	return flowID + "." + sig, nil
}

func ParseFlowIDCookie(cookieValue, secret string) (string, error) {
	if secret == "" {
		return "", errors.New("oauth2 flow signing secret is empty")
	}
	parts := strings.Split(cookieValue, ".")
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", errors.New("invalid oauth2 flow cookie")
	}

	flowID := parts[0]
	expectedSig := signFlowID(flowID, secret)
	if !hmac.Equal([]byte(expectedSig), []byte(parts[1])) {
		return "", fmt.Errorf("invalid oauth2 flow cookie signature")
	}
	return flowID, nil
}

func signFlowID(flowID, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(flowID))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
