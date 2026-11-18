package plugin

import "net/http"

// HTTPPlugin is the optional capability for extensions that contribute endpoints.
type HTTPPlugin interface {
	Routes() []Route
}

type Route struct {
	Method  string
	Path    string
	Handler http.HandlerFunc
	// Public skips Studio session authentication for this exact method and path.
	// It requires a canonical literal path without route parameters. The plugin
	// remains responsible for any authentication required by its endpoint.
	Public bool
}
