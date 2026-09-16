package nebula

import (
	"fmt"
	"sync"

	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
)

var (
	// clientId -> nebula-client map, used to store the nebula client for console
	consoleContainer map[string]*nebulaTypes.Client = make(map[string]*nebulaTypes.Client)
	consoleMux       sync.Mutex
)

func SetConsoleClient(clientId string, client *nebulaTypes.Client) {
	consoleMux.Lock()
	defer consoleMux.Unlock()
	consoleContainer[clientId] = client
}

func GetConsoleClient(clientId string) (*nebulaTypes.Client, error) {
	consoleMux.Lock()
	defer consoleMux.Unlock()
	client := consoleContainer[clientId]
	if client == nil {
		return nil, fmt.Errorf("client not existed")
	}
	// NOTE: Ping 会导致 SHOW WARNINGS 的查询结果为空
	// if err := (*client).Ping(); err != nil {
	// 	(*client).Close()
	// 	return nil, fmt.Errorf("ping failed")
	// }
	return client, nil
}

func ClearConsoleClient(clientId string) {
	consoleMux.Lock()
	defer consoleMux.Unlock()
	delete(consoleContainer, clientId)
}
