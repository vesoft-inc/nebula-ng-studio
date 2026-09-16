package snapshot

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AddSnapshotLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Add Snapshot
func NewAddSnapshotLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AddSnapshotLogic {
	return &AddSnapshotLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AddSnapshotLogic) AddSnapshot(req *types.AddSnapshotParams) (resp *types.SnapshotActionResult, err error) {
	return explorer.NewSnapshotService(l.ctx, l.svcCtx).Add(req)
}
