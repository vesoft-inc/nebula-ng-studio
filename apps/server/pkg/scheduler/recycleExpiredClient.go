package scheduler

import (
	"context"
	"time"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/zeromicro/go-zero/core/logx"
)

func RecycleExpiredClientScheduler() {
	Run(context.Background())
}

// Run recycles expired clients until ctx is cancelled.
func Run(ctx context.Context) {
	logx.Info("[Scheduler] Start Recycle Expired Client Scheduler")
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		clientContainer := nebula.GetClientContainer()
		clientContainer.RemoveExpiredClient()
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
