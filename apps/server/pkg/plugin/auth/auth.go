// Package auth defines the experimental Studio database-session API for plugins.
// Its interfaces may change between Studio releases.
package auth

import "context"

// ConnectParams describes a database connection, independent of Studio's client
// container and JWT format. An empty DefaultSchema uses the database default.
type ConnectParams struct {
	Address       string
	Username      string
	DefaultSchema string
	Credentials   Credentials
}

// Credentials selects exactly one Graphd authentication method. Set one pointer:
// Password may point to an empty string; GraphdToken must be non-empty and is
// passed to Graphd as-is, including any prefix required by the external service.
type Credentials struct {
	Password    *string
	GraphdToken *string
}

// Session contains an opaque Studio credential. It refers to a database client
// held by the current Studio process; plugins must not depend on its encoding.
type Session struct {
	Token string
}

type CookieConfig struct {
	Name   string
	MaxAge int64
}

type Service interface {
	// OpenSession authenticates with Graphd and registers a Studio session.
	// Failed or canceled creation cleans up any client registered by this call.
	// It does not write a Cookie or otherwise modify an HTTP response.
	OpenSession(context.Context, ConnectParams) (Session, error)
	CookieConfig() CookieConfig
}

// Provider is implemented by hosts that offer Studio authentication services.
type Provider interface {
	Auth() Service
}
