package health

import (
	"net/http"
	"strconv"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
)

var (
	livenessBody             = []byte(`{"status":"ok"}`)
	readinessOKBody          = []byte(`{"database":"ok"}`)
	readinessDisabledBody    = []byte(`{"database":"disabled"}`)
	readinessUnavailableBody = []byte(`{"database":"unavailable"}`)
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeProbeResponse(w, r, http.StatusOK, livenessBody)
}

func readinessHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch service.DatabaseReadiness(r.Context(), svcCtx) {
		case service.DatabaseReady:
			writeProbeResponse(w, r, http.StatusOK, readinessOKBody)
		case service.DatabaseDisabled:
			writeProbeResponse(w, r, http.StatusOK, readinessDisabledBody)
		default:
			writeProbeResponse(w, r, http.StatusServiceUnavailable, readinessUnavailableBody)
		}
	}
}

func writeProbeResponse(w http.ResponseWriter, r *http.Request, status int, body []byte) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_, _ = w.Write(body)
	}
}
