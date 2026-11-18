package plugin

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

type testHost struct{}

func (testHost) Respond(w http.ResponseWriter, _ *http.Request, _ any, _ error) {
	w.WriteHeader(http.StatusNoContent)
}

type barePlugin struct{ name string }

func (p *barePlugin) Name() string { return p.name }

type testPlugin struct {
	barePlugin
	routes []Route
	close  func() error
}

func (p *testPlugin) Routes() []Route { return p.routes }
func (p *testPlugin) Close() error {
	if p.close != nil {
		return p.close()
	}
	return nil
}

func registerForTest(t *testing.T, name string, factory Factory) {
	t.Helper()
	RegisterPlugin(name, factory)
	t.Cleanup(func() {
		registry.Lock()
		delete(registry.factories, name)
		registry.Unlock()
	})
}

func TestLoadOnlySelectedPluginsWithoutAuthentication(t *testing.T) {
	name := t.Name()
	initialized := 0
	registerForTest(t, name, func(host Host) (Plugin, error) {
		initialized++
		return &testPlugin{
			barePlugin: barePlugin{name},
			routes: []Route{
				{Method: http.MethodPost, Path: "/extra/login", Public: true, Handler: func(w http.ResponseWriter, r *http.Request) {
					host.Respond(w, r, nil, nil)
				}},
			},
		}, nil
	})
	empty, err := Load(nil, testHost{})
	require.NoError(t, err)
	require.Empty(t, empty.Routes())
	require.NoError(t, empty.Close())
	require.Zero(t, initialized)
	for _, test := range []struct {
		names   []string
		message string
	}{
		{[]string{name, name + "-missing"}, "not registered in this build"},
		{[]string{name, name}, "configured more than once"},
	} {
		_, err := Load(test.names, testHost{})
		require.ErrorContains(t, err, test.message)
		require.Zero(t, initialized)
	}
	loaded, err := Load([]string{name}, testHost{})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, loaded.Close()) })
	require.Equal(t, 1, initialized)
	routes := loaded.Routes()
	require.Len(t, routes, 1)
	recorder := httptest.NewRecorder()
	routes[0].Handler(recorder, httptest.NewRequest(http.MethodPost, routes[0].Path, nil))
	require.Equal(t, http.StatusNoContent, recorder.Code)
	routes[0].Public = false
	require.True(t, loaded.Routes()[0].Public, "caller mutations must not change contributed authentication policy")
}

func TestNonHTTPPluginAndOptionalClose(t *testing.T) {
	name := t.Name()
	registerForTest(t, name, func(Host) (Plugin, error) {
		return &barePlugin{name}, nil
	})
	loaded, err := Load([]string{name}, testHost{})
	require.NoError(t, err)
	require.Empty(t, loaded.Routes())
	require.NoError(t, loaded.Close())
	require.NoError(t, loaded.Close())
}

func TestPluginInstancesHaveIndependentLifetimes(t *testing.T) {
	name := t.Name()
	initialized, closed := 0, 0
	registerForTest(t, name, func(Host) (Plugin, error) {
		initialized++
		return &testPlugin{barePlugin: barePlugin{name}, close: func() error { closed++; return nil }}, nil
	})
	first, err := Load([]string{name}, testHost{})
	require.NoError(t, err)
	second, err := Load([]string{name}, testHost{})
	require.NoError(t, err)
	require.Equal(t, 2, initialized)
	require.NoError(t, first.Close())
	require.NoError(t, first.Close())
	require.Equal(t, 1, closed)
	require.NoError(t, second.Close())
	require.Equal(t, 2, closed)
}

func TestInitializationFailureClosesPriorPlugins(t *testing.T) {
	names := []string{t.Name() + "-first", t.Name() + "-second", t.Name() + "-failed"}
	var order []string
	cleanupError := errors.New("cleanup failed")
	initializeError := errors.New("initialize failed")
	for _, name := range names[:2] {
		registerForTest(t, name, func(Host) (Plugin, error) {
			return &testPlugin{barePlugin: barePlugin{name}, close: func() error {
				order = append(order, name)
				if name == names[0] {
					return cleanupError
				}
				return nil
			}}, nil
		})
	}
	registerForTest(t, names[2], func(Host) (Plugin, error) {
		return &testPlugin{barePlugin: barePlugin{names[2]}, close: func() error {
			order = append(order, names[2])
			return nil
		}}, initializeError
	})
	loaded, err := Load(names, testHost{})
	require.Nil(t, loaded)
	require.ErrorIs(t, err, initializeError)
	require.ErrorIs(t, err, cleanupError)
	require.Equal(t, []string{names[2], names[1], names[0]}, order)
}

func TestUnexpectedPluginNameClosesInstance(t *testing.T) {
	name, closed := t.Name(), false
	registerForTest(t, name, func(Host) (Plugin, error) {
		return &testPlugin{barePlugin: barePlugin{"wrong-name"}, close: func() error {
			closed = true
			return nil
		}}, nil
	})
	loaded, err := Load([]string{name}, testHost{})
	require.Nil(t, loaded)
	require.ErrorContains(t, err, "returned instance named")
	require.True(t, closed)
}
