package service

import (
	"context"
	"errors"

	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/utils"
	"github.com/zeromicro/go-zero/core/logx"
	"gorm.io/gorm"
)

var _ SketchService = (*sketchService)(nil)

type (
	SketchService interface {
		CreateSketch(request *types.CreateSketchRequest) (*types.SketchIDResult, error)
		GetList(request *types.GetSketchesRequest) (*types.SketchList, error)
		Delete(request *types.DeleteSketchRequest) error
		Update(request *types.UpdateSketchRequest) error
		GetTotal() (*types.SketchTotalNumResult, error)
		GetSketchItem(request *types.GetSketchItemRequest) (*types.GetSketchItemResult, error)
	}

	sketchService struct {
		logx.Logger
		ctx              context.Context
		svcCtx           *svc.ServiceContext
		gormErrorWrapper utils.GormErrorWrapper
	}
)

var errDatabaseDisabled = errors.New("studio database is disabled")

func NewSketchService(ctx context.Context, svcCtx *svc.ServiceContext) SketchService {
	return &sketchService{
		Logger:           logx.WithContext(ctx),
		ctx:              ctx,
		svcCtx:           svcCtx,
		gormErrorWrapper: utils.GormErrorWithLogger(ctx),
	}
}

func (s *sketchService) CreateSketch(request *types.CreateSketchRequest) (*types.SketchIDResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	user, err := s.currentUser()
	if err != nil {
		return nil, err
	}
	sketch := &db.Sketch{
		Host:        user.Address,
		IfNotExists: request.IfNotExists,
		Username:    user.Username,
		Name:        request.Name,
		Schema:      request.Schema,
		Snapshot:    request.Snapshot,
	}
	result := database.Create(sketch)
	if result.Error != nil {
		return nil, s.gormErrorWrapper(result.Error)
	}
	return &types.SketchIDResult{
		ID: sketch.ID,
	}, nil
}

func (s *sketchService) Delete(request *types.DeleteSketchRequest) error {
	database, err := s.database()
	if err != nil {
		return err
	}
	user, err := s.currentUser()
	if err != nil {
		return err
	}
	result := sketchIDQuery(database, user, request.ID).Delete(&db.Sketch{})
	if result.Error != nil {
		return s.gormErrorWrapper(result.Error)
	}
	if result.RowsAffected == 0 {
		return sketchNotFoundError()
	}
	return nil
}

func (s *sketchService) GetList(request *types.GetSketchesRequest) (*types.SketchList, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	user, err := s.currentUser()
	if err != nil {
		return nil, err
	}
	var sketchList []db.Sketch
	filters := sketchOwnerQuery(database, user)
	if request.Keyword != "" {
		filters = filters.Where("name LIKE ?", "%"+request.Keyword+"%")
	}
	result := filters.Scopes(utils.Paginate(request.Page, request.PageSize)).Order("create_time desc").Find(&sketchList)
	if result.Error != nil {
		return nil, s.gormErrorWrapper(result.Error)
	}
	items := make([]types.Sketch, 0)
	for _, sketch := range sketchList {
		items = append(items, types.Sketch{
			ID:          sketch.ID,
			Name:        sketch.Name,
			IfNotExists: sketch.IfNotExists,
			Snapshot:    sketch.Snapshot,
		})
	}
	var total int64
	if err := sketchOwnerQuery(database, user).Model(&db.Sketch{}).Count(&total).Error; err != nil {
		return nil, s.gormErrorWrapper(err)
	}
	return &types.SketchList{
		Items:    items,
		Total:    total,
		Page:     request.Page,
		PageSize: request.PageSize,
	}, nil
}

func (s *sketchService) Update(request *types.UpdateSketchRequest) error {
	database, err := s.database()
	if err != nil {
		return err
	}
	user, err := s.currentUser()
	if err != nil {
		return err
	}
	result := sketchIDQuery(database, user, request.ID).Model(&db.Sketch{}).Updates(map[string]interface{}{
		"name":          request.Name,
		"schema":        request.Schema,
		"snapshot":      request.Snapshot,
		"if_not_exists": request.IfNotExists,
	})
	if result.Error != nil {
		return s.gormErrorWrapper(result.Error)
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := sketchIDQuery(database, user, request.ID).Model(&db.Sketch{}).Count(&count).Error; err != nil {
			return s.gormErrorWrapper(err)
		}
		if count == 0 {
			return sketchNotFoundError()
		}
	}
	return nil
}

func (s *sketchService) GetTotal() (*types.SketchTotalNumResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	user, err := s.currentUser()
	if err != nil {
		return nil, err
	}
	var total int64
	result := sketchOwnerQuery(database, user).Model(&db.Sketch{}).Count(&total)
	if result.Error != nil {
		return nil, s.gormErrorWrapper(result.Error)
	}
	return &types.SketchTotalNumResult{
		Total: total,
	}, nil
}

func (s *sketchService) GetSketchItem(request *types.GetSketchItemRequest) (*types.GetSketchItemResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	user, err := s.currentUser()
	if err != nil {
		return nil, err
	}
	var sketch db.Sketch
	result := sketchIDQuery(database, user, request.ID).Take(&sketch)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, sketchNotFoundError()
	}
	if result.Error != nil {
		return nil, s.gormErrorWrapper(result.Error)
	}
	return &types.GetSketchItemResult{
		Item: types.Sketch{
			ID:          sketch.ID,
			Name:        sketch.Name,
			IfNotExists: sketch.IfNotExists,
			Schema:      sketch.Schema,
			Snapshot:    sketch.Snapshot,
		},
	}, nil
}

func (s *sketchService) currentUser() (*auth.AuthData, error) {
	user, ok := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	if !ok || user == nil || user.Address == "" || user.Username == "" {
		return nil, ecode.WithUnauthorized(errors.New("missing studio auth data"))
	}
	return user, nil
}

func sketchOwnerQuery(database *gorm.DB, user *auth.AuthData) *gorm.DB {
	return database.Where("host = ? AND username = ?", user.Address, user.Username)
}

func sketchIDQuery(database *gorm.DB, user *auth.AuthData, id int) *gorm.DB {
	return sketchOwnerQuery(database, user).Where("id = ?", id)
}

func sketchNotFoundError() error {
	return ecode.WithNotFound(errors.New("sketch not found"))
}

func (s *sketchService) database() (*gorm.DB, error) {
	if s.svcCtx.DB == nil {
		return nil, s.gormErrorWrapper(errDatabaseDisabled)
	}
	return s.svcCtx.DB, nil
}
