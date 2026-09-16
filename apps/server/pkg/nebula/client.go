package nebula

import (
	"container/list"
	"fmt"
	"time"

	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	"github.com/zeromicro/go-zero/core/logx"
)

type ClientLRU struct {
	capacity int
	cache    map[string]*list.Element
	list     *list.List
}

type Client struct {
	ID              string
	nebulaPool      *nebulaTypes.Pool
	LastExecuteTime time.Time
	CurSchemaPath   string
	Timeout         int
}

func (c *Client) GetPool() nebulaTypes.Pool {
	return *c.nebulaPool
}

func (c *Client) GetNebulaClient() (*nebulaTypes.Client, error) {
	if c.nebulaPool == nil {
		return nil, fmt.Errorf("client pool is not exist")
	}
	pool := c.GetPool()
	client, err := pool.GetClient()
	if err != nil {
		return nil, err
	}

	return &client, nil
}

func (c *Client) SetCurSchemaPath(path string) {
	c.CurSchemaPath = path
}

func (c *Client) ReleaseNebulaClient(client *nebulaTypes.Client) {
	if c.nebulaPool == nil {
		logx.Error("client pool is not exist")
		return
	}
	pool := c.GetPool()
	pool.PutClient(*client)
}

func (c *Client) PutToContainer(clientId string) {
	c.ID = clientId
	clientContainer.PutClient(clientId, c)
}

func (c *Client) IsExpired() bool {
	expiredDuration := config.GetConfig().Nebula.ClientExpiredDuration
	return time.Since(c.LastExecuteTime) > time.Duration(expiredDuration)*time.Minute
}

func NewClientLRU(capacity int) *ClientLRU {
	return &ClientLRU{
		capacity: capacity,
		cache:    make(map[string]*list.Element),
		list:     list.New(),
	}
}

// Get retrieves the client from the container and updates its priority.
func (c *ClientLRU) GetClient(key string) *Client {
	if elem, ok := c.cache[key]; ok {
		c.list.MoveToFront(elem)
		return elem.Value.(*Client)
	}
	return nil
}

// Put inserts a client into the container.
func (c *ClientLRU) PutClient(key string, client *Client) {
	if elem, ok := c.cache[key]; ok {
		logx.Infof("client %s already existed, update client instance, and move to first\n", key)
		c.list.MoveToFront(elem)
		elem.Value = client
		return
	}
	if c.list.Len() == c.capacity {
		elem := c.list.Back()
		if elem != nil {
			c.list.Remove(elem)
			delete(c.cache, elem.Value.(*Client).ID)
			logx.Infof("client container has over capacity, remove the lowest container, %s\n", elem.Value.(*Client).ID)
		}
	}
	logx.Infof("client %s is new, add it to container\n", key)
	elem := c.list.PushFront(client)
	c.cache[key] = elem
}

func (c *ClientLRU) RemoveExpiredClient() {
	for _, elem := range c.cache {
		client := elem.Value.(*Client)
		if client.IsExpired() {
			c.list.Remove(elem)
			delete(c.cache, client.ID)
			logx.Infof("client %s is expired, remove it\n", client.ID)
		}
	}
}

func (c *ClientLRU) RemoveSpecClient(key string) {
	if elem, ok := c.cache[key]; ok {
		c.list.Remove(elem)
		delete(c.cache, key)
		logx.Infof("client disconnect, remove it %s", key)
	}
}
