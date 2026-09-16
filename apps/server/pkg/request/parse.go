package request

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/zeromicro/go-zero/core/mapping"
	"github.com/zeromicro/go-zero/rest/httpx"
)

const (
	LargeExplorerRequestBytes int64 = 32 << 20
	explorerPrefix                  = "/api-studio/explorer"
)

var errRequestTooLarge = errors.New("request body exceeds the allowed size")

// ParseLargeExplorerWrite bypasses go-zero's fixed 8 MiB JSON reader. It is
// only used by the three Explorer handlers in the large-write allowlist.
func ParseLargeExplorerWrite(r *http.Request, value any) error {
	err := parseLargeExplorerRequest(r, value)
	if err == nil {
		return nil
	}
	if errors.Is(err, errRequestTooLarge) {
		return ecode.WithErrorMessage(ecode.ErrRequestTooLarge, err)
	}
	return ecode.WithErrorMessage(ecode.ErrParam, err)
}

// IsLargeExplorerWrite matches only the three endpoints whose request bodies
// may contain serialized graph data or uploaded icon data.
func IsLargeExplorerWrite(r *http.Request) bool {
	if r == nil || r.URL == nil {
		return false
	}
	requestPath := path.Clean(r.URL.Path)

	switch r.Method {
	case http.MethodPost:
		if requestPath == explorerPrefix+"/snapshots" {
			return true
		}
		return isSinglePathSegment(requestPath, explorerPrefix+"/icongroup/") &&
			requestPath != explorerPrefix+"/icongroup/add"
	case http.MethodPut:
		return isSinglePathSegment(requestPath, explorerPrefix+"/snapshots/")
	default:
		return false
	}
}

func isSinglePathSegment(requestPath, prefix string) bool {
	segment, found := strings.CutPrefix(requestPath, prefix)
	return found && segment != "" && !strings.Contains(segment, "/")
}

func parseLargeExplorerRequest(r *http.Request, value any) error {
	if err := httpx.ParsePath(r, value); err != nil {
		return err
	}
	if err := httpx.ParseForm(r, value); err != nil {
		return err
	}
	if err := httpx.ParseHeaders(r, value); err != nil {
		return err
	}
	return parseLargeJSONBody(r, value)
}

func parseLargeJSONBody(r *http.Request, value any) error {
	if r.Body == nil || !strings.Contains(strings.ToLower(r.Header.Get("Content-Type")), "application/json") {
		return mapping.UnmarshalJsonMap(nil, value)
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, LargeExplorerRequestBytes+1))
	if err != nil {
		return fmt.Errorf("read request body: %w", err)
	}
	if int64(len(body)) > LargeExplorerRequestBytes {
		return errRequestTooLarge
	}
	if len(body) == 0 {
		return mapping.UnmarshalJsonMap(nil, value)
	}
	return mapping.UnmarshalJsonBytes(body, value)
}
