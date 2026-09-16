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

type IconGroupService struct {
	ctx              context.Context
	svcCtx           *svc.ServiceContext
	withErrorMessage utils.WithErrorMessage
}

func NewIconGroupService(ctx context.Context, svcCtx *svc.ServiceContext) *IconGroupService {
	return &IconGroupService{
		ctx:              ctx,
		svcCtx:           svcCtx,
		withErrorMessage: utils.ErrMsgWithLogger(ctx),
	}
}

func (s *IconGroupService) AddGroup(request *types.AddIconGroupParams) (*types.IconGroupActionResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}
	if request.Type != "svg" && request.Type != "img" {
		return nil, s.withErrorMessage(ecode.ErrParam, fmt.Errorf("unsupported icon group type %q", request.Type))
	}

	group := &db.IconGroup{
		BID:      s.svcCtx.IDGenerator.Generate(),
		Name:     request.Name,
		Type:     request.Type,
		Host:     user.Address,
		Username: user.Username,
	}
	if err := database.Create(group).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	return &types.IconGroupActionResult{ID: group.BID}, nil
}

func (s *IconGroupService) ListGroups(request *types.GetIconGroupsParams) (*types.GetIconGroupsResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	var groups []db.IconGroup
	query := database.Where("host = ? AND username = ?", user.Address, user.Username)
	if request.Type != "" {
		if request.Type != "svg" && request.Type != "img" {
			return nil, s.withErrorMessage(ecode.ErrParam, fmt.Errorf("unsupported icon group type %q", request.Type))
		}
		query = query.Where("type = ?", request.Type)
	}
	if err := query.Order("create_time asc, id asc").Find(&groups).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}

	items := make([]types.IconGroupItem, 0, len(groups))
	for _, group := range groups {
		items = append(items, types.IconGroupItem{
			ID:         group.BID,
			Name:       group.Name,
			Type:       group.Type,
			CreateTime: group.CreateTime.UnixMilli(),
			UpdateTime: group.UpdateTime.UnixMilli(),
		})
	}
	return &types.GetIconGroupsResult{Items: items}, nil
}

func (s *IconGroupService) DeleteGroup(request *types.DeleteIconGroupParams) (*types.IconGroupActionResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}

	err = database.Transaction(func(transaction *gorm.DB) error {
		if _, err := s.ownedGroup(transaction, user, request.GroupId); err != nil {
			return err
		}
		if err := transaction.Where("group_id = ?", request.GroupId).Delete(&db.IconItem{}).Error; err != nil {
			return s.withErrorMessage(ecode.ErrInternalDatabase, err)
		}
		result := transaction.Where("b_id = ? AND host = ? AND username = ?", request.GroupId, user.Address, user.Username).
			Delete(&db.IconGroup{})
		if result.Error != nil {
			return s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
		}
		if result.RowsAffected == 0 {
			return s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("icon group %s not found", request.GroupId))
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &types.IconGroupActionResult{ID: request.GroupId}, nil
}

func (s *IconGroupService) UpdateGroup(request *types.UpdateIconGroupParams) (*types.IconGroupActionResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}
	if request.Name == "" {
		return nil, s.withErrorMessage(ecode.ErrParam, errors.New("icon group name is required"))
	}

	result := database.Model(&db.IconGroup{}).
		Where("b_id = ? AND host = ? AND username = ?", request.GroupId, user.Address, user.Username).
		Update("name", request.Name)
	if result.Error != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := database.Model(&db.IconGroup{}).
			Where("b_id = ? AND host = ? AND username = ?", request.GroupId, user.Address, user.Username).
			Count(&count).Error; err != nil {
			return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
		}
		if count == 0 {
			return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("icon group %s not found", request.GroupId))
		}
	}
	return &types.IconGroupActionResult{ID: request.GroupId}, nil
}

func (s *IconGroupService) AddIcon(request *types.AddIconParams) (*types.IconActionResult, error) {
	if err := validateMediumText("icon", request.Icon); err != nil {
		return nil, s.withErrorMessage(ecode.ErrParam, err)
	}
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}
	if _, err := s.ownedGroup(database, user, request.GroupId); err != nil {
		return nil, err
	}

	id := s.svcCtx.IDGenerator.Generate()
	icon := &db.IconItem{
		BID:     id,
		Name:    request.Name,
		GroupID: request.GroupId,
		Icon:    request.Icon,
	}
	if err := database.Create(icon).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	return &types.IconActionResult{ID: id}, nil
}

func (s *IconGroupService) ListIcons(request *types.GetIconParams) (*types.GetIconResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}
	if _, err := s.ownedGroup(database, user, request.GroupId); err != nil {
		return nil, err
	}

	var icons []db.IconItem
	if err := database.Where("group_id = ?", request.GroupId).Order("create_time desc, id desc").Find(&icons).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	items := make([]types.IconItem, 0, len(icons))
	for _, icon := range icons {
		items = append(items, types.IconItem{
			ID:         icon.BID,
			Name:       icon.Name,
			GroupId:    icon.GroupID,
			Icon:       icon.Icon,
			CreateTime: icon.CreateTime.UnixMilli(),
		})
	}
	return &types.GetIconResult{Items: items}, nil
}

func (s *IconGroupService) DeleteIcon(request *types.DeleteIconParams) (*types.IconActionResult, error) {
	database, user, err := s.dependencies()
	if err != nil {
		return nil, err
	}
	if _, err := s.ownedGroup(database, user, request.GroupId); err != nil {
		return nil, err
	}

	result := database.Where("b_id = ? AND group_id = ?", request.IconId, request.GroupId).Delete(&db.IconItem{})
	if result.Error != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("icon %s not found", request.IconId))
	}
	return &types.IconActionResult{ID: request.IconId}, nil
}

func (s *IconGroupService) dependencies() (*gorm.DB, *auth.AuthData, error) {
	if s.svcCtx.DB == nil {
		return nil, nil, s.withErrorMessage(ecode.ErrInternalDatabase, errors.New("studio database is disabled"))
	}
	user, ok := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	if !ok || user == nil || user.Username == "" {
		return nil, nil, s.withErrorMessage(ecode.ErrUnauthorized, errors.New("missing studio auth data"))
	}
	return s.svcCtx.DB, user, nil
}

func (s *IconGroupService) ownedGroup(database *gorm.DB, user *auth.AuthData, groupID string) (*db.IconGroup, error) {
	var group db.IconGroup
	err := database.Where("b_id = ? AND host = ? AND username = ?", groupID, user.Address, user.Username).Take(&group).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("icon group %s not found", groupID))
	}
	if err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	return &group, nil
}
