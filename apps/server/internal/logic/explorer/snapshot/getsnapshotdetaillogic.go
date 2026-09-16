package snapshot

import (
	"context"

	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/service/explorer"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetSnapshotDetailLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get Snapshot Detail
func NewGetSnapshotDetailLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetSnapshotDetailLogic {
	return &GetSnapshotDetailLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetSnapshotDetailLogic) GetSnapshotDetail(req *types.GetSnapshotDetailParams) (resp *types.SnapshotItem, err error) {
	return explorer.NewSnapshotService(l.ctx, l.svcCtx).Detail(req)
}
