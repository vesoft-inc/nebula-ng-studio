package explorer

import (
	"testing"

	"github.com/stretchr/testify/require"
	db "github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/model"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/internal/types"
)

func TestIconGroupServiceCRUDOwnershipAndCascade(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	alice := NewIconGroupService(contextWithUser("alice"), serviceContext)
	bob := NewIconGroupService(contextWithUser("bob"), serviceContext)

	group, err := alice.AddGroup(&types.AddIconGroupParams{Name: "People", Type: "svg"})
	require.NoError(t, err)
	require.Equal(t, "test-id-1", group.ID)

	groups, err := alice.ListGroups(&types.GetIconGroupsParams{Type: "svg"})
	require.NoError(t, err)
	require.Len(t, groups.Items, 1)
	require.Equal(t, "svg", groups.Items[0].Type)

	bobGroups, err := bob.ListGroups(&types.GetIconGroupsParams{Type: "svg"})
	require.NoError(t, err)
	require.Empty(t, bobGroups.Items)

	icon, err := alice.AddIcon(&types.AddIconParams{GroupId: group.ID, Name: "Person", Icon: "<svg />"})
	require.NoError(t, err)
	require.Equal(t, "test-id-2", icon.ID)

	_, err = bob.AddIcon(&types.AddIconParams{GroupId: group.ID, Name: "Stolen", Icon: "<svg />"})
	require.Error(t, err)
	_, err = bob.ListIcons(&types.GetIconParams{GroupId: group.ID})
	require.Error(t, err)
	_, err = bob.DeleteIcon(&types.DeleteIconParams{GroupId: group.ID, IconId: icon.ID})
	require.Error(t, err)

	items, err := alice.ListIcons(&types.GetIconParams{GroupId: group.ID})
	require.NoError(t, err)
	require.Len(t, items.Items, 1)
	require.Equal(t, icon.ID, items.Items[0].ID)
	require.Equal(t, group.ID, items.Items[0].GroupId)

	updated, err := alice.UpdateGroup(&types.UpdateIconGroupParams{GroupId: group.ID, Name: "Renamed"})
	require.NoError(t, err)
	require.Equal(t, group.ID, updated.ID)

	deleted, err := alice.DeleteGroup(&types.DeleteIconGroupParams{GroupId: group.ID})
	require.NoError(t, err)
	require.Equal(t, group.ID, deleted.ID)

	var groupCount, iconCount int64
	require.NoError(t, serviceContext.DB.Model(&db.IconGroup{}).Count(&groupCount).Error)
	require.NoError(t, serviceContext.DB.Model(&db.IconItem{}).Count(&iconCount).Error)
	require.Zero(t, groupCount)
	require.Zero(t, iconCount)
}

func TestIconGroupServiceValidatesTypeAndNotFound(t *testing.T) {
	serviceContext := newExplorerServiceContext(t)
	service := NewIconGroupService(contextWithUser("alice"), serviceContext)

	_, err := service.AddGroup(&types.AddIconGroupParams{Name: "Invalid", Type: "pdf"})
	require.Error(t, err)
	_, err = service.ListGroups(&types.GetIconGroupsParams{Type: "pdf"})
	require.Error(t, err)
	_, err = service.DeleteGroup(&types.DeleteIconGroupParams{GroupId: "missing"})
	require.Error(t, err)
}
