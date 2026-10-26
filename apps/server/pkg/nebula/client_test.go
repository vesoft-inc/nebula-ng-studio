package nebula

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
)

func TestClientLRUEvictionAndRemoval(t *testing.T) {
	cache := NewClientLRU(2)
	first := &Client{ID: "first"}
	cache.PutClient(first.ID, first)
	cache.PutClient("second", &Client{ID: "second"})
	require.Same(t, first, cache.GetClient("first"))
	cache.PutClient("third", &Client{ID: "third"})
	require.Nil(t, cache.GetClient("second"))
	require.Equal(t, 2, cache.Len())

	replacement := &Client{ID: "first"}
	cache.PutClient("first", replacement)
	require.Same(t, replacement, cache.RemoveSpecClient("first"))
	require.Nil(t, cache.GetClient("first"))
	require.Nil(t, cache.RemoveSpecClient("first"))
	require.Equal(t, 1, cache.Len())
}

func TestClientLRUConcurrentAccess(t *testing.T) {
	cfg := &config.Config{Nebula: config.Nebula{ClientExpiredDuration: 60}}
	require.NoError(t, cfg.InitConfig())
	cache := NewClientLRU(4)
	start := make(chan struct{})
	var workers sync.WaitGroup
	for worker := 0; worker < 8; worker++ {
		workers.Add(1)
		go func(worker int) {
			defer workers.Done()
			<-start
			for i := 0; i < 50; i++ {
				id := fmt.Sprintf("client-%d", (worker+i)%6)
				lastExecute := time.Now()
				if i%3 == 0 {
					lastExecute = lastExecute.Add(-2 * time.Hour)
				}
				cache.PutClient(id, &Client{ID: id, LastExecuteTime: lastExecute})
				cache.GetClient(id)
				cache.Len()
				if i%2 == 0 {
					cache.RemoveSpecClient(id)
				} else {
					cache.RemoveExpiredClient()
				}
			}
		}(worker)
	}
	close(start)
	workers.Wait()

	require.LessOrEqual(t, cache.Len(), 4)
	require.Equal(t, len(cache.cache), cache.Len())
	seen := make(map[string]bool)
	for elem := cache.list.Front(); elem != nil; elem = elem.Next() {
		id := elem.Value.(*Client).ID
		require.False(t, seen[id], "duplicate LRU entry: %s", id)
		seen[id] = true
		require.Same(t, elem, cache.cache[id])
	}
	require.Len(t, seen, cache.Len())

	cache.PutClient("expired", &Client{ID: "expired", LastExecuteTime: time.Now().Add(-2 * time.Hour)})
	cache.RemoveExpiredClient()
	require.Nil(t, cache.GetClient("expired"))
}
