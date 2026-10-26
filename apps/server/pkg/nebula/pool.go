package nebula

import (
	"errors"
	"fmt"
	"sync"
	"time"

	nebula "github.com/vesoft-inc/nebula-go/v5"
	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"github.com/zeromicro/go-zero/core/logx"
)

var (
	clientContainer *ClientLRU
	clientMux       sync.Mutex

	ErrClientNotExisted = errors.New("get client error: client not existed")
)

func InitClientContainer() {
	clientMaxNum := config.GetConfig().Nebula.ClientMaxNum
	clientContainer = NewClientLRU(clientMaxNum)
}

func GetClientContainer() *ClientLRU {
	logx.Infof("clientContainer len: %v", clientContainer.Len())
	return clientContainer
}

func NewClient(address string, username string, password string, token string, schemaPath string, timeoutSeconds int) (*Client, error) {
	return newClient(address, username, password, token, "", schemaPath, timeoutSeconds)
}

func NewOAuth2Client(address string, username string, token string, serverName string, schemaPath string, timeoutSeconds int) (*Client, error) {
	return newClient(address, username, "", token, serverName, schemaPath, timeoutSeconds)
}

func newClient(address string, username string, password string, token string, authServerName string, schemaPath string, timeoutSeconds int) (*Client, error) {
	clientMux.Lock()
	defer clientMux.Unlock()

	globalConfig := config.GetConfig()
	clientPoolMaxOpenConns := globalConfig.Nebula.ClientPoolConnsMaxOpen
	clientPoolMaxIdleConns := globalConfig.Nebula.ClientMaxIdleConns
	clientPoolMinIdleConns := globalConfig.Nebula.ClientPoolConnsMinOpen
	clientPoolMaxWait := time.Duration(globalConfig.Nebula.ClientPoolMaxWait) * time.Second

	// Use custom timeout if provided, otherwise use default config timeout
	var clientRequestTimeout time.Duration
	if timeoutSeconds > 0 {
		clientRequestTimeout = time.Duration(timeoutSeconds) * time.Second
	} else {
		clientRequestTimeout = time.Duration(globalConfig.Nebula.ClientRequestTimeout) * time.Second
	}

	var pool nebulaTypes.Pool
	var err error

	poolOptions := []nebula.PoolOptionsFn{
		nebula.WithPoolMaxOpenConns(clientPoolMaxOpenConns),
		nebula.WithPoolMinOpenConns(clientPoolMinIdleConns),
		nebula.WithPoolMaxIdleConns(clientPoolMaxIdleConns),
		nebula.WithPoolMaxWait(clientPoolMaxWait),
		nebula.WithPoolRequestTimeout(clientRequestTimeout),
	}

	if schemaPath != "" {
		poolOptions = append(poolOptions,
			nebula.WithPoolSchema(fmt.Sprintf("%s", schemaPath)),
		)
	}

	if globalConfig.IsEnableNebulaTLS() {
		poolOptions = append(poolOptions,
			nebula.WithPoolTLS(globalConfig.Auth.Ca, globalConfig.Auth.CertFile, globalConfig.Auth.KeyFile, globalConfig.Auth.InsecureSkipVerify))
	}

	if token != "" {
		authInfo := map[string]string{"token": token}
		if authServerName != "" {
			authInfo["grant_type"] = "authorization_code"
			authInfo["server"] = authServerName
		}
		poolOptions = append(poolOptions, nebula.WithPoolAuthInfo(authInfo))
	}
	pool, err = nebula.NewNebulaPool(address, username, password, poolOptions...)
	if err != nil {
		return nil, err
	}
	uniqueId, err := utils.GenerateRandomID(16)
	if err != nil {
		return nil, err
	}

	if schemaPath == "" {
		c, err := pool.GetClient()
		if err != nil {
			return nil, err
		}
		defer pool.PutClient(c)
		res, err := graphd.RunGql(c, "SHOW CURRENT_SCHEMA")
		if err != nil {
			return nil, err
		}
		path := res.Tables[0]["path"].(nebulaTypes.String)
		schemaPath = path.String()
	}

	client := &Client{
		ID:              uniqueId,
		nebulaPool:      &pool,
		LastExecuteTime: time.Now(),
		CurSchemaPath:   schemaPath,
		Timeout:         int(clientRequestTimeout.Seconds()),
	}
	return client, nil
}

func GetClient(uniqueId string) (*Client, error) {
	client := clientContainer.GetClient(uniqueId)
	if client == nil {
		return nil, ErrClientNotExisted
	}
	return client, nil
}

func RemoveClient(uniqueId string) {
	clientMux.Lock()
	defer clientMux.Unlock()
	client := clientContainer.RemoveSpecClient(uniqueId)
	if client != nil {
		client.GetPool().Close()
	}
	ClearConsoleClient(uniqueId)
}

func PingWithClientInfo(address string, username string, password string) (string, error) {
	globalConfig := config.GetConfig()
	var c nebulaTypes.Client
	var err error
	poolOptions := []nebula.ClientOptionsFn{
		nebula.WithClientRequestTimeout(time.Duration(globalConfig.Nebula.ClientRequestTimeout) * time.Second),
	}
	if globalConfig.IsEnableNebulaTLS() {
		poolOptions = append(poolOptions,
			nebula.WithClientTLS(globalConfig.Auth.Ca, globalConfig.Auth.CertFile, globalConfig.Auth.KeyFile, false),
		)
	}
	c, err = nebula.NewNebulaClient(
		address,
		username,
		password,
		poolOptions...,
	)
	if err != nil {
		return "", err
	}
	defer c.Close()
	if err := c.Ping(); err != nil {
		return "", err
	}
	resp, err := graphd.RunGql(c, "show version")
	if err != nil {
		return "", err
	}
	version := resp.Tables[0]["version"].(nebulaTypes.String)
	return version.String(), nil
}

func PingWithOAuth2ClientInfo(address string, username string, token string, serverName string) (string, error) {
	return pingWithTokenAuth(address, username, token, serverName)
}

func pingWithTokenAuth(address string, username string, token string, serverName string) (string, error) {
	globalConfig := config.GetConfig()
	var c nebulaTypes.Client
	var err error
	authInfo := map[string]string{"token": token}
	if serverName != "" {
		authInfo["grant_type"] = "authorization_code"
		authInfo["server"] = serverName
	}
	if globalConfig.Auth.Ca != "" && globalConfig.Auth.CertFile != "" && globalConfig.Auth.KeyFile != "" {
		c, err = nebula.NewNebulaClient(address, username, "",
			nebula.WithClientRequestTimeout(time.Duration(globalConfig.Nebula.ClientRequestTimeout)*time.Second),
			nebula.WithClientAuthInfo(authInfo),
			nebula.WithClientTLS(globalConfig.Auth.Ca, globalConfig.Auth.CertFile, globalConfig.Auth.KeyFile, globalConfig.Auth.InsecureSkipVerify),
		)
	} else {
		c, err = nebula.NewNebulaClient(address, username, "",
			nebula.WithClientRequestTimeout(time.Duration(globalConfig.Nebula.ClientRequestTimeout)*time.Second),
			nebula.WithClientAuthInfo(authInfo),
		)
	}
	if err != nil {
		return "", err
	}
	defer c.Close()
	if err := c.Ping(); err != nil {
		return "", err
	}
	resp, err := graphd.RunGql(c, "show version")
	if err != nil {
		return "", err
	}
	version := resp.Tables[0]["version"].(nebulaTypes.String)
	return version.String(), nil
}

func PingClient(client *Client) error {
	pool := client.GetPool()
	c, err := pool.GetClient()
	if err != nil {
		return err
	}
	defer pool.PutClient(c)
	if err := c.Ping(); err != nil {
		return err
	}
	return nil
}
