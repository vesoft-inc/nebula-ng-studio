package explorer

import (
	"context"
	"errors"
	"fmt"

	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"gorm.io/gorm"
)

type SnapshotService struct {
	ctx              context.Context
	svcCtx           *svc.ServiceContext
	withErrorMessage utils.WithErrorMessage
}

func NewSnapshotService(ctx context.Context, svcCtx *svc.ServiceContext) *SnapshotService {
	return &SnapshotService{
		ctx:              ctx,
		svcCtx:           svcCtx,
		withErrorMessage: utils.ErrMsgWithLogger(ctx),
	}
}

func (s *SnapshotService) Add(request *types.AddSnapshotParams) (*types.SnapshotActionResult, error) {
	if err := validateMediumText("thumbnail", request.Thumbnail); err != nil {
		return nil, s.withErrorMessage(ecode.ErrParam, err)
	}
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	id := s.svcCtx.IDGenerator.Generate()
	snapshot := &db.Snapshot{
		ID:         id,
		Name:       request.Name,
		Data:       request.Data,
		Host:       user.Address,
		Username:   user.Username,
		Graph:      request.Graph,
		GraphType:  request.GraphType,
		SchemaPath: request.SchemaPath,
		Thumbnail:  request.Thumbnail,
	}
	if err := database.Create(snapshot).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	return &types.SnapshotActionResult{ID: id}, nil
}

func (s *SnapshotService) List(request *types.GetSnapshotsParams) (*types.GetSnapshotsResult, error) {
	filter, err := parseSnapshotListFilter(request.Filter)
	if err != nil {
		return nil, s.withErrorMessage(ecode.ErrParam, err)
	}
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	query := applySnapshotListFilter(
		database.Model(&db.Snapshot{}).
			Where("host = ? AND username = ?", user.Address, user.Username),
		filter,
	)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}

	var snapshots []db.Snapshot
	offset := (request.Page - 1) * request.PageSize
	if err := query.Select("id", "name", "graph", "graph_type", "thumbnail", "created_at", "updated_at").
		Order("updated_at desc").Offset(offset).Limit(request.PageSize).Find(&snapshots).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}

	items := make([]types.SnapshotItem, 0, len(snapshots))
	for _, snapshot := range snapshots {
		items = append(items, snapshotItem(snapshot))
	}

	return &types.GetSnapshotsResult{
		Total:    int(total),
		Page:     request.Page,
		PageSize: request.PageSize,
		Items:    items,
	}, nil
}

func (s *SnapshotService) Detail(request *types.GetSnapshotDetailParams) (*types.SnapshotItem, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	var snapshot db.Snapshot
	err = database.Where("id = ? AND host = ? AND username = ?", request.ID, user.Address, user.Username).
		Take(&snapshot).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("snapshot %s not found", request.ID))
	}
	if err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	item := snapshotItem(snapshot)
	return &item, nil
}

func (s *SnapshotService) Update(request *types.UpdateSnapshotParams) (*types.SnapshotActionResult, error) {
	if err := validateMediumText("thumbnail", request.Thumbnail); err != nil {
		return nil, s.withErrorMessage(ecode.ErrParam, err)
	}
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	values := make(map[string]interface{})
	if request.Name != "" {
		values["name"] = request.Name
	}
	if request.Data != "" {
		values["data"] = request.Data
	}
	if request.Thumbnail != "" {
		values["thumbnail"] = request.Thumbnail
	}
	if len(values) == 0 {
		return nil, s.withErrorMessage(ecode.ErrParam, errors.New("no update field"))
	}

	result := database.Model(&db.Snapshot{}).
		Where("id = ? AND host = ? AND username = ?", request.ID, user.Address, user.Username).
		Updates(values)
	if result.Error != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := database.Model(&db.Snapshot{}).
			Where("id = ? AND host = ? AND username = ?", request.ID, user.Address, user.Username).
			Count(&count).Error; err != nil {
			return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
		}
		if count == 0 {
			return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("snapshot %s not found", request.ID))
		}
	}
	return &types.SnapshotActionResult{ID: request.ID}, nil
}

func (s *SnapshotService) Delete(request *types.DeleteSnapshotParams) (*types.SnapshotActionResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	result := database.Where("id = ? AND host = ? AND username = ?", request.ID, user.Address, user.Username).
		Delete(&db.Snapshot{})
	if result.Error != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("snapshot %s not found", request.ID))
	}
	return &types.SnapshotActionResult{ID: request.ID}, nil
}

func (s *SnapshotService) dependencies() (*gorm.DB, *auth.AuthData, error) {
	if s.svcCtx.DB == nil {
		return nil, nil, s.withErrorMessage(ecode.ErrInternalDatabase, errors.New("studio database is disabled"))
	}
	user, ok := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	if !ok || user == nil || user.Username == "" {
		return nil, nil, s.withErrorMessage(ecode.ErrUnauthorized, errors.New("missing studio auth data"))
	}
	return s.svcCtx.DB, user, nil
}

func snapshotItem(snapshot db.Snapshot) types.SnapshotItem {
	return types.SnapshotItem{
		ID:        snapshot.ID,
		Name:      snapshot.Name,
		Graph:     snapshot.Graph,
		GraphType: snapshot.GraphType,
		Data:      snapshot.Data,
		Thumbnail: snapshot.Thumbnail,
		CreatedAt: snapshot.CreatedAt.UnixMilli(),
		UpdatedAt: snapshot.UpdatedAt.UnixMilli(),
	}
}
