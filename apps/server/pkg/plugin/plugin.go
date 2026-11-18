// Package plugin provides an experimental API for trusted extensions compiled into Studio.
//
// The plugin API is unstable and may change between Studio releases.
// Pin the Studio server module version and test extensions when upgrading.
package plugin

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"sync"
)

// Host provides the shared Studio response protocol. Additional capabilities
// are exposed through optional provider interfaces in their owning packages.
type Host interface {
	Respond(http.ResponseWriter, *http.Request, any, error)
}

// Plugin is one initialized extension. HTTP routes and io.Closer are optional.
type Plugin interface {
	Name() string
}

type Factory func(Host) (Plugin, error)

var registry = struct {
	sync.RWMutex
	factories map[string]Factory
}{factories: make(map[string]Factory)}

// RegisterPlugin registers a factory without initializing its plugin.
// This experimental registration API may change between Studio releases.
func RegisterPlugin(name string, factory Factory) {
	if name == "" || factory == nil {
		panic("Studio plugin registration requires a name and factory")
	}
	registry.Lock()
	defer registry.Unlock()
	if _, exists := registry.factories[name]; exists {
		panic(fmt.Sprintf("Studio plugin %q is already registered", name))
	}
	registry.factories[name] = factory
}

type namedPlugin struct {
	name     string
	instance Plugin
}

// Loaded owns the instances initialized for one Studio startup.
type Loaded struct {
	instances []namedPlugin
	routes    []Route
	closeOnce sync.Once
	closeErr  error
}

// Load validates the selection before initializing plugins in configuration order.
// An initialization failure closes already created instances in reverse order.
// The host validates contributed routes against its router before mounting them.
func Load(names []string, host Host) (_ *Loaded, err error) {
	factories, err := configuredPlugins(names)
	if err != nil {
		return nil, err
	}
	loaded := &Loaded{}
	defer func() {
		if err != nil {
			err = errors.Join(err, loaded.Close())
		}
	}()
	for index, factory := range factories {
		instance, initErr := factory(host)
		// A factory may forward a nil concrete pointer as a Plugin.
		if v := reflect.ValueOf(instance); v.Kind() == reflect.Pointer && v.IsNil() {
			instance = nil
		}
		if instance != nil {
			loaded.instances = append(loaded.instances, namedPlugin{names[index], instance})
		}
		if initErr != nil {
			return nil, fmt.Errorf("initialize Studio plugin %q: %w", names[index], initErr)
		}
		if instance == nil {
			return nil, fmt.Errorf("Studio plugin %q returned no instance", names[index])
		}
		instanceName := instance.Name()
		if instanceName != names[index] {
			return nil, fmt.Errorf("Studio plugin %q returned instance named %q", names[index], instanceName)
		}
		if httpPlugin, ok := instance.(HTTPPlugin); ok {
			loaded.routes = append(loaded.routes, httpPlugin.Routes()...)
		}
	}
	return loaded, nil
}

func configuredPlugins(names []string) ([]Factory, error) {
	registry.RLock()
	defer registry.RUnlock()
	factories := make([]Factory, 0, len(names))
	selected := make(map[string]bool, len(names))
	for _, name := range names {
		if selected[name] {
			return nil, fmt.Errorf("Studio plugin %q is configured more than once", name)
		}
		factory, exists := registry.factories[name]
		if !exists {
			return nil, fmt.Errorf("Studio plugin %q is not registered in this build", name)
		}
		selected[name] = true
		factories = append(factories, factory)
	}
	return factories, nil
}

// Routes returns a snapshot of the HTTP contributions.
func (loaded *Loaded) Routes() []Route {
	return append([]Route(nil), loaded.routes...)
}

// Close releases optional plugin resources once, in reverse initialization order.
func (loaded *Loaded) Close() error {
	loaded.closeOnce.Do(func() {
		for index := len(loaded.instances) - 1; index >= 0; index-- {
			entry := loaded.instances[index]
			if closer, ok := entry.instance.(io.Closer); ok {
				if err := closer.Close(); err != nil {
					loaded.closeErr = errors.Join(loaded.closeErr, fmt.Errorf("close Studio plugin %q: %w", entry.name, err))
				}
			}
		}
	})
	return loaded.closeErr
}
