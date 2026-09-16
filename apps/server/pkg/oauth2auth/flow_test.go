package oauth2auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestFlowCookieSignatureRejectsTampering(t *testing.T) {
	cookieValue, err := SignFlowID("flow-1", "secret")
	require.NoError(t, err)

	flowID, err := ParseFlowIDCookie(cookieValue, "secret")
	require.NoError(t, err)
	require.Equal(t, "flow-1", flowID)

	_, err = ParseFlowIDCookie(cookieValue+"tampered", "secret")
	require.Error(t, err)

	_, err = ParseFlowIDCookie(cookieValue, "wrong-secret")
	require.Error(t, err)
}

func TestFlowStoreConsumeOneTime(t *testing.T) {
	store := NewFlowStore(time.Minute)
	require.NoError(t, store.Set("flow-1", &FlowContext{State: "state"}))

	flow, ok := store.Consume("flow-1")
	require.True(t, ok)
	require.Equal(t, "state", flow.State)

	_, ok = store.Consume("flow-1")
	require.False(t, ok)
}

func TestFlowStoreConsumeExpired(t *testing.T) {
	store := NewFlowStore(time.Nanosecond)
	require.NoError(t, store.Set("flow-1", &FlowContext{State: "state"}))
	time.Sleep(time.Millisecond)

	_, ok := store.Consume("flow-1")
	require.False(t, ok)
}
