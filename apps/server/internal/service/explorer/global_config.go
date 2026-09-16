package explorer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GlobalConfigService struct {
	svcCtx           *svc.ServiceContext
	withErrorMessage utils.WithErrorMessage
}

func NewGlobalConfigService(ctx context.Context, svcCtx *svc.ServiceContext) *GlobalConfigService {
	return &GlobalConfigService{
		svcCtx:           svcCtx,
		withErrorMessage: utils.ErrMsgWithLogger(ctx),
	}
}

func (s *GlobalConfigService) Add(request *types.AddGlobalConfigParams) (*types.GlobalConfigActionResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	item := &db.GlobalConfig{Key: request.Key, Value: request.Value}
	if err := database.Create(item).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	return &types.GlobalConfigActionResult{Key: item.Key}, nil
}

func (s *GlobalConfigService) List(request *types.GetGlobalConfigsParams) (*types.GetGlobalConfigsResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}

	filter := make(map[string]interface{})
	if request.Filter != "" {
		if err := json.Unmarshal([]byte(request.Filter), &filter); err != nil {
			return nil, s.withErrorMessage(ecode.ErrParam, err)
		}
	}
	query := database.Model(&db.GlobalConfig{})
	if len(filter) > 0 {
		query = query.Where(filter)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}

	var configs []db.GlobalConfig
	offset := (request.Page - 1) * request.PageSize
	if err := query.Order("updated_at desc").Offset(offset).Limit(request.PageSize).Find(&configs).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	items := make([]types.GlobalConfigItem, 0, len(configs))
	for _, config := range configs {
		items = append(items, globalConfigItem(config))
	}
	return &types.GetGlobalConfigsResult{
		Total:    int(total),
		Page:     request.Page,
		PageSize: request.PageSize,
		Items:    items,
	}, nil
}

func (s *GlobalConfigService) Detail(request *types.GetGlobalConfigParams) (*types.GlobalConfigItem, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	var config db.GlobalConfig
	err = database.Where("`key` = ?", request.Key).Take(&config).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("global config %s not found", request.Key))
	}
	if err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	item := globalConfigItem(config)
	return &item, nil
}

func (s *GlobalConfigService) Update(request *types.UpdateGlobalConfigParams) (*types.GlobalConfigActionResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	if request.Value == "" {
		return nil, s.withErrorMessage(ecode.ErrParam, errors.New("no update field"))
	}
	result := database.Model(&db.GlobalConfig{}).Where("`key` = ?", request.Key).Update("value", request.Value)
	if result.Error != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := database.Model(&db.GlobalConfig{}).Where("`key` = ?", request.Key).Count(&count).Error; err != nil {
			return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
		}
		if count == 0 {
			return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("global config %s not found", request.Key))
		}
	}
	return &types.GlobalConfigActionResult{Key: request.Key}, nil
}

func (s *GlobalConfigService) Delete(request *types.DeleteGlobalConfigParams) (*types.GlobalConfigActionResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	result := database.Where("`key` = ?", request.Key).Delete(&db.GlobalConfig{})
	if result.Error != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, s.withErrorMessage(ecode.ErrNotFound, fmt.Errorf("global config %s not found", request.Key))
	}
	return &types.GlobalConfigActionResult{Key: request.Key}, nil
}

func (s *GlobalConfigService) Upsert(request *types.UpsertGlobalConfigParams) (*types.UpsertGlobalConfigResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	item := &db.GlobalConfig{Key: request.Key, Value: request.Value}
	if err := database.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(item).Error; err != nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, err)
	}
	return &types.UpsertGlobalConfigResult{Key: item.Key}, nil
}

func (s *GlobalConfigService) database() (*gorm.DB, error) {
	if s.svcCtx.DB == nil {
		return nil, s.withErrorMessage(ecode.ErrInternalDatabase, errors.New("studio database is disabled"))
	}
	return s.svcCtx.DB, nil
}

func globalConfigItem(config db.GlobalConfig) types.GlobalConfigItem {
	return types.GlobalConfigItem{
		Key:       config.Key,
		Value:     config.Value,
		UpdatedAt: config.UpdatedAt.UnixMilli(),
	}
}
