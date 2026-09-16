package scheduler

import (
	"time"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/nebula"
	"github.com/zeromicro/go-zero/core/logx"
)

func RecycleExpiredClientScheduler() {
	logx.Info("[Scheduler] Start Recycle Expired Client Scheduler")
	for {
		clientContainer := nebula.GetClientContainer()
		clientContainer.RemoveExpiredClient()
		time.Sleep(time.Hour * 24)
	}
}
