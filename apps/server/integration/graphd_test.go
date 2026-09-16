//go:build integration

package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	commonutils "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
)

type apiResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func TestStudioGraphdIntegration(t *testing.T) {
	baseURL := strings.TrimRight(requiredEnvironment(t, "STUDIO_INTEGRATION_BASE_URL"), "/")
	graphdAddress := requiredEnvironment(t, "STUDIO_INTEGRATION_GRAPHD_ADDRESS")
	username := requiredEnvironment(t, "STUDIO_INTEGRATION_GRAPHD_USERNAME")
	password := requiredEnvironment(t, "STUDIO_INTEGRATION_GRAPHD_PASSWORD")
	parsedBaseURL, err := url.Parse(baseURL)
	if err != nil || (parsedBaseURL.Scheme != "http" && parsedBaseURL.Scheme != "https") || parsedBaseURL.Host == "" {
		t.Fatalf("STUDIO_INTEGRATION_BASE_URL must be an absolute HTTP(S) URL: %q", baseURL)
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("create cookie jar: %v", err)
	}
	client := &http.Client{Jar: jar, Timeout: 30 * time.Second}
	credentials, err := json.Marshal([]string{username, password})
	if err != nil {
		t.Fatalf("encode Graphd credentials: %v", err)
	}
	authorization, err := commonutils.Sm4Encrypt(credentials, "")
	if err != nil {
		t.Fatalf("encrypt Graphd credentials: %v", err)
	}

	connectRequest, err := json.Marshal(map[string]string{"address": graphdAddress})
	if err != nil {
		t.Fatalf("encode connect request: %v", err)
	}
	status, response := callAPI(t, client, http.MethodPost, baseURL+"/api-studio/db/connect", connectRequest, map[string]string{
		"Authorization": "Bearer " + authorization,
	})
	requireSuccessfulAPI(t, "connect", status, response)

	status, response = callAPI(t, client, http.MethodGet, baseURL+"/api-studio/nebula/userInfo", nil, nil)
	requireSuccessfulAPI(t, "user info", status, response)

	for name, scenario := range map[string]struct {
		endpoint string
		gql      string
	}{
		"Query":           {endpoint: "/api-studio/nebula/console/execGql", gql: "SHOW VERSION"},
		"Schema":          {endpoint: "/api-studio/gql/exec", gql: "SHOW SCHEMAS"},
		"Explorer Graphd": {endpoint: "/api-studio/gql/exec", gql: "SHOW GRAPHS"},
	} {
		requestBody, marshalErr := json.Marshal(map[string]interface{}{"gql": scenario.gql, "timeout": 10})
		if marshalErr != nil {
			t.Fatalf("encode %s request: %v", name, marshalErr)
		}
		status, response = callAPI(t, client, http.MethodPost, baseURL+scenario.endpoint, requestBody, nil)
		requireSuccessfulAPI(t, name, status, response)
	}

	status, response = callAPI(t, client, http.MethodGet, baseURL+"/api-studio/explorer/snapshots", nil, nil)
	requireSuccessfulAPI(t, "Explorer snapshots", status, response)

	status, response = callAPI(t, client, http.MethodPost, baseURL+"/api-studio/db/disconnect", []byte("{}"), nil)
	requireSuccessfulAPI(t, "disconnect", status, response)

	status, response = callAPI(t, client, http.MethodGet, baseURL+"/api-studio/nebula/userInfo", nil, nil)
	if status < http.StatusBadRequest && response.Code == 0 {
		t.Fatal("user info remained authorized after disconnect")
	}
}

func requiredEnvironment(t *testing.T, name string) string {
	t.Helper()
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		t.Fatalf("%s is required for the explicit Graphd integration profile", name)
	}
	return value
}

func callAPI(
	t *testing.T,
	client *http.Client,
	method string,
	endpoint string,
	body []byte,
	headers map[string]string,
) (int, apiResponse) {
	t.Helper()
	request, err := http.NewRequest(method, endpoint, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create %s %s: %v", method, endpoint, err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}

	httpResponse, err := client.Do(request)
	if err != nil {
		t.Fatalf("call %s %s: %v", method, endpoint, err)
	}
	defer httpResponse.Body.Close()
	responseBody, err := io.ReadAll(httpResponse.Body)
	if err != nil {
		t.Fatalf("read %s %s: %v", method, endpoint, err)
	}
	var response apiResponse
	if len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, &response); err != nil {
			response.Message = fmt.Sprintf("non-JSON response: %s", strings.TrimSpace(string(responseBody)))
			response.Code = -1
		}
	}
	return httpResponse.StatusCode, response
}

func requireSuccessfulAPI(t *testing.T, name string, status int, response apiResponse) {
	t.Helper()
	if status >= http.StatusBadRequest || response.Code != 0 {
		t.Fatalf("%s failed: HTTP %d, API code %d: %s", name, status, response.Code, response.Message)
	}
}
