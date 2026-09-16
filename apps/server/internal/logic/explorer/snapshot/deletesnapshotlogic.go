package snapshot

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type DeleteSnapshotLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Delete Snapshot
func NewDeleteSnapshotLogic(ctx context.Context, svcCtx *svc.ServiceContext) *DeleteSnapshotLogic {
	return &DeleteSnapshotLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *DeleteSnapshotLogic) DeleteSnapshot(req *types.DeleteSnapshotParams) (resp *types.SnapshotActionResult, err error) {
	return explorer.NewSnapshotService(l.ctx, l.svcCtx).Delete(req)
}
