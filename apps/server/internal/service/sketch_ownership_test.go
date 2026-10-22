package service

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/config"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/svc"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/auth"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/ecode"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestSketchServiceEnforcesOwnership(t *testing.T) {
	serviceContext := newSketchServiceContext(t)
	const (
		hostA = "graphd-a.example.test:9669"
		hostB = "graphd-b.example.test:9669"
	)

	aliceHostA := NewSketchService(sketchContextWithUser(hostA, "alice"), serviceContext)
	bobHostA := NewSketchService(sketchContextWithUser(hostA, "bob"), serviceContext)
	aliceHostB := NewSketchService(sketchContextWithUser(hostB, "alice"), serviceContext)

	aliceSketch, err := aliceHostA.CreateSketch(&types.CreateSketchRequest{
		Name:        "alice original",
		IfNotExists: true,
		Schema:      "schema-original",
		Snapshot:    "snapshot-original",
	})
	require.NoError(t, err)
	_, err = aliceHostA.CreateSketch(&types.CreateSketchRequest{Name: "alice second"})
	require.NoError(t, err)
	bobSketch, err := bobHostA.CreateSketch(&types.CreateSketchRequest{Name: "bob sketch"})
	require.NoError(t, err)
	_, err = aliceHostB.CreateSketch(&types.CreateSketchRequest{Name: "other host sketch"})
	require.NoError(t, err)

	list, err := aliceHostA.GetList(&types.GetSketchesRequest{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.Equal(t, int64(2), list.Total)
	require.Len(t, list.Items, 2)
	for _, item := range list.Items {
		require.True(t, strings.HasPrefix(item.Name, "alice "))
	}

	total, err := aliceHostA.GetTotal()
	require.NoError(t, err)
	require.Equal(t, int64(2), total.Total)
	total, err = aliceHostB.GetTotal()
	require.NoError(t, err)
	require.Equal(t, int64(1), total.Total)

	detail, err := aliceHostA.GetSketchItem(&types.GetSketchItemRequest{ID: aliceSketch.ID})
	require.NoError(t, err)
	require.Equal(t, "alice original", detail.Item.Name)
	require.Equal(t, "schema-original", detail.Item.Schema)
	require.Equal(t, "snapshot-original", detail.Item.Snapshot)

	bobDetail, bobDetailErr := bobHostA.GetSketchItem(&types.GetSketchItemRequest{ID: aliceSketch.ID})
	bobDetailErr = requireSketchNotFoundResult(t, bobDetail, bobDetailErr)
	missingDetail, missingDetailErr := aliceHostA.GetSketchItem(
		&types.GetSketchItemRequest{ID: aliceSketch.ID + 1000},
	)
	missingDetailErr = requireSketchNotFoundResult(t, missingDetail, missingDetailErr)
	require.Equal(t, bobDetailErr.Error(), missingDetailErr.Error())

	crossHostDetail, crossHostDetailErr := aliceHostB.GetSketchItem(
		&types.GetSketchItemRequest{ID: aliceSketch.ID},
	)
	crossHostDetailErr = requireSketchNotFoundResult(t, crossHostDetail, crossHostDetailErr)
	require.Equal(t, bobDetailErr.Error(), crossHostDetailErr.Error())

	bobUpdateErr := bobHostA.Update(&types.UpdateSketchRequest{
		ID:     aliceSketch.ID,
		Name:   "stolen by bob",
		Schema: "stolen-schema",
	})
	require.True(t, ecode.IsNotFound(bobUpdateErr), "expected NotFound, got %v", bobUpdateErr)
	missingUpdateErr := aliceHostA.Update(&types.UpdateSketchRequest{
		ID:   aliceSketch.ID + 1000,
		Name: "missing",
	})
	require.True(t, ecode.IsNotFound(missingUpdateErr), "expected NotFound, got %v", missingUpdateErr)
	require.Equal(t, bobUpdateErr.Error(), missingUpdateErr.Error())

	crossHostUpdateErr := aliceHostB.Update(&types.UpdateSketchRequest{
		ID:   aliceSketch.ID,
		Name: "stolen from another host",
	})
	require.True(t, ecode.IsNotFound(crossHostUpdateErr), "expected NotFound, got %v", crossHostUpdateErr)
	require.Equal(t, bobUpdateErr.Error(), crossHostUpdateErr.Error())

	bobDeleteErr := bobHostA.Delete(&types.DeleteSketchRequest{ID: aliceSketch.ID})
	require.True(t, ecode.IsNotFound(bobDeleteErr), "expected NotFound, got %v", bobDeleteErr)
	missingDeleteErr := aliceHostA.Delete(&types.DeleteSketchRequest{ID: aliceSketch.ID + 1000})
	require.True(t, ecode.IsNotFound(missingDeleteErr), "expected NotFound, got %v", missingDeleteErr)
	require.Equal(t, bobDeleteErr.Error(), missingDeleteErr.Error())

	crossHostDeleteErr := aliceHostB.Delete(&types.DeleteSketchRequest{ID: aliceSketch.ID})
	require.True(t, ecode.IsNotFound(crossHostDeleteErr), "expected NotFound, got %v", crossHostDeleteErr)
	require.Equal(t, bobDeleteErr.Error(), crossHostDeleteErr.Error())

	var stored db.Sketch
	require.NoError(t, serviceContext.DB.Unscoped().First(&stored, aliceSketch.ID).Error)
	require.Equal(t, "alice original", stored.Name)
	require.Equal(t, "schema-original", stored.Schema)
	require.False(t, stored.DeletedAt.Valid)

	ownedUpdate := &types.UpdateSketchRequest{
		ID:          aliceSketch.ID,
		Name:        "alice renamed",
		IfNotExists: false,
		Schema:      "schema-renamed",
		Snapshot:    "snapshot-renamed",
	}
	require.NoError(t, aliceHostA.Update(ownedUpdate))
	require.NoError(t, aliceHostA.Update(ownedUpdate), "an unchanged owned update must still succeed")

	detail, err = aliceHostA.GetSketchItem(&types.GetSketchItemRequest{ID: aliceSketch.ID})
	require.NoError(t, err)
	require.Equal(t, "alice renamed", detail.Item.Name)
	require.Equal(t, "schema-renamed", detail.Item.Schema)
	require.Equal(t, "snapshot-renamed", detail.Item.Snapshot)

	filteredList, err := aliceHostA.GetList(&types.GetSketchesRequest{Page: 1, PageSize: 10, Keyword: "renamed"})
	require.NoError(t, err)
	require.Len(t, filteredList.Items, 1)
	require.Equal(t, int64(2), filteredList.Total)

	require.NoError(t, aliceHostA.Delete(&types.DeleteSketchRequest{ID: aliceSketch.ID}))
	_, err = aliceHostA.GetSketchItem(&types.GetSketchItemRequest{ID: aliceSketch.ID})
	require.True(t, ecode.IsNotFound(err), "expected NotFound after delete, got %v", err)

	bobDetail, err = bobHostA.GetSketchItem(&types.GetSketchItemRequest{ID: bobSketch.ID})
	require.NoError(t, err)
	require.Equal(t, "bob sketch", bobDetail.Item.Name)
}

func TestSketchServiceRejectsMissingAuthData(t *testing.T) {
	serviceContext := newSketchServiceContext(t)
	service := NewSketchService(context.Background(), serviceContext)

	tests := []struct {
		name string
		call func() error
	}{
		{
			name: "create",
			call: func() error {
				_, err := service.CreateSketch(&types.CreateSketchRequest{Name: "sketch"})
				return err
			},
		},
		{
			name: "list",
			call: func() error {
				_, err := service.GetList(&types.GetSketchesRequest{Page: 1, PageSize: 10})
				return err
			},
		},
		{
			name: "total",
			call: func() error {
				_, err := service.GetTotal()
				return err
			},
		},
		{
			name: "detail",
			call: func() error {
				_, err := service.GetSketchItem(&types.GetSketchItemRequest{ID: 1})
				return err
			},
		},
		{
			name: "update",
			call: func() error {
				return service.Update(&types.UpdateSketchRequest{ID: 1, Name: "updated"})
			},
		},
		{
			name: "delete",
			call: func() error {
				return service.Delete(&types.DeleteSketchRequest{ID: 1})
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.call()
			require.Error(t, err)
			require.True(t, ecode.IsUnauthorized(err), "expected Unauthorized, got %v", err)
		})
	}
}

func newSketchServiceContext(t *testing.T) *svc.ServiceContext {
	t.Helper()
	databaseName := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	database, err := gorm.Open(
		sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", databaseName)),
		&gorm.Config{Logger: logger.Default.LogMode(logger.Silent)},
	)
	require.NoError(t, err)
	require.NoError(t, db.ApplySchemaMigrations(database))

	t.Cleanup(func() {
		sqlDB, sqlErr := database.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return svc.NewServiceContext(config.Config{}, database)
}

func sketchContextWithUser(host, username string) context.Context {
	return context.WithValue(context.Background(), auth.CtxKeyUserInfo{}, &auth.AuthData{
		Address:  host,
		Username: username,
	})
}

func requireSketchNotFoundResult[T any](t *testing.T, result *T, err error) error {
	t.Helper()
	require.Nil(t, result)
	require.Error(t, err)
	require.True(t, ecode.IsNotFound(err), "expected NotFound, got %v", err)
	return err
}
