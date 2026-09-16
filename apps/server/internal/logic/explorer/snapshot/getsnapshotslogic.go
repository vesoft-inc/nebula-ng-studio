package snapshot

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetSnapshotsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get Snapshots
func NewGetSnapshotsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetSnapshotsLogic {
	return &GetSnapshotsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetSnapshotsLogic) GetSnapshots(req *types.GetSnapshotsParams) (resp *types.GetSnapshotsResult, err error) {
	return explorer.NewSnapshotService(l.ctx, l.svcCtx).List(req)
}
