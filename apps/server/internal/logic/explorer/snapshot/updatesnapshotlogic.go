package snapshot

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type UpdateSnapshotLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Update Snapshot
func NewUpdateSnapshotLogic(ctx context.Context, svcCtx *svc.ServiceContext) *UpdateSnapshotLogic {
	return &UpdateSnapshotLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *UpdateSnapshotLogic) UpdateSnapshot(req *types.UpdateSnapshotParams) (resp *types.SnapshotActionResult, err error) {
	return explorer.NewSnapshotService(l.ctx, l.svcCtx).Update(req)
}
