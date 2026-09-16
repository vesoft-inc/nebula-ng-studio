package service

import (
	"context"
	"errors"

	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
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
	auth := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	sketch := &db.Sketch{
		Host:        auth.Address,
		IfNotExists: request.IfNotExists,
		Username:    auth.Username,
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
	result := database.Delete(&db.Sketch{}, "id = ?", request.ID)
	if result.Error != nil {
		return s.gormErrorWrapper(result.Error)
	}
	return nil
}

func (s *sketchService) GetList(request *types.GetSketchesRequest) (*types.SketchList, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	auth := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	var sketchList []db.Sketch
	filters := database.Where("host = ?", auth.Address)
	filters = filters.Where("username = ?", auth.Username)
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
	database.Model(&db.Sketch{}).Where("host = ? AND username = ?", auth.Address, auth.Username).Count(&total)
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
	result := database.Model(&db.Sketch{}).Where("id = ?", request.ID).Updates(map[string]interface{}{
		"name":          request.Name,
		"schema":        request.Schema,
		"snapshot":      request.Snapshot,
		"if_not_exists": request.IfNotExists,
	})
	if result.Error != nil {
		return s.gormErrorWrapper(result.Error)
	}
	return nil
}

func (s *sketchService) GetTotal() (*types.SketchTotalNumResult, error) {
	database, err := s.database()
	if err != nil {
		return nil, err
	}
	auth := s.ctx.Value(auth.CtxKeyUserInfo{}).(*auth.AuthData)
	var total int64
	result := database.Model(&db.Sketch{}).Where("host = ?", auth.Address).Count(&total)
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
	var sketchItem types.Sketch
	result := database.Model(&db.Sketch{}).Where("id = ?", request.ID).Find(&sketchItem)
	if result.Error != nil {
		return nil, s.gormErrorWrapper(result.Error)
	}
	return &types.GetSketchItemResult{
		Item: sketchItem,
	}, nil
}

func (s *sketchService) database() (*gorm.DB, error) {
	if s.svcCtx.DB == nil {
		return nil, s.gormErrorWrapper(errDatabaseDisabled)
	}
	return s.svcCtx.DB, nil
}
