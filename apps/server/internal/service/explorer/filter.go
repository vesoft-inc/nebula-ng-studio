package explorer

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type globalConfigListFilter struct {
	Key   *string
	Value *string
}

type snapshotListFilter struct {
	Name       *string
	Graph      *string
	SchemaPath *string
}

func parseGlobalConfigListFilter(raw string) (globalConfigListFilter, error) {
	fields, err := parseFilterFields(raw)
	if err != nil {
		return globalConfigListFilter{}, err
	}
	for field := range fields {
		switch field {
		case "key", "value":
		default:
			return globalConfigListFilter{}, fmt.Errorf("unsupported global config filter field %q", field)
		}
	}

	var filter globalConfigListFilter
	if rawValue, ok := fields["key"]; ok {
		value, decodeErr := parseStringFilterValue("key", rawValue)
		if decodeErr != nil {
			return globalConfigListFilter{}, decodeErr
		}
		filter.Key = &value
	}
	if rawValue, ok := fields["value"]; ok {
		value, decodeErr := parseStringFilterValue("value", rawValue)
		if decodeErr != nil {
			return globalConfigListFilter{}, decodeErr
		}
		filter.Value = &value
	}
	return filter, nil
}

func parseSnapshotListFilter(raw string) (snapshotListFilter, error) {
	fields, err := parseFilterFields(raw)
	if err != nil {
		return snapshotListFilter{}, err
	}
	for field := range fields {
		switch field {
		case "name", "graph", "schema_path":
		default:
			return snapshotListFilter{}, fmt.Errorf("unsupported snapshot filter field %q", field)
		}
	}

	var filter snapshotListFilter
	if rawValue, ok := fields["name"]; ok {
		value, decodeErr := parseStringFilterValue("name", rawValue)
		if decodeErr != nil {
			return snapshotListFilter{}, decodeErr
		}
		filter.Name = &value
	}
	if rawValue, ok := fields["graph"]; ok {
		value, decodeErr := parseStringFilterValue("graph", rawValue)
		if decodeErr != nil {
			return snapshotListFilter{}, decodeErr
		}
		filter.Graph = &value
	}
	if rawValue, ok := fields["schema_path"]; ok {
		value, decodeErr := parseStringFilterValue("schema_path", rawValue)
		if decodeErr != nil {
			return snapshotListFilter{}, decodeErr
		}
		filter.SchemaPath = &value
	}
	return filter, nil
}

func parseFilterFields(raw string) (map[string]json.RawMessage, error) {
	if strings.TrimSpace(raw) == "" {
		return map[string]json.RawMessage{}, nil
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &fields); err != nil {
		return nil, err
	}
	if fields == nil {
		return nil, errors.New("filter must be a JSON object")
	}
	return fields, nil
}

func parseStringFilterValue(field string, raw json.RawMessage) (string, error) {
	var value *string
	if err := json.Unmarshal(raw, &value); err != nil || value == nil {
		return "", fmt.Errorf("%s filter value must be a string", field)
	}
	return *value, nil
}

func applyGlobalConfigListFilter(query *gorm.DB, filter globalConfigListFilter) *gorm.DB {
	if filter.Key != nil {
		query = query.Where("`key` = ?", *filter.Key)
	}
	if filter.Value != nil {
		query = query.Where("value = ?", *filter.Value)
	}
	return query
}

func applySnapshotListFilter(query *gorm.DB, filter snapshotListFilter) *gorm.DB {
	if filter.Name != nil {
		query = query.Where("name LIKE ?", "%"+*filter.Name+"%")
	}
	if filter.Graph != nil {
		query = query.Where("graph = ?", *filter.Graph)
	}
	if filter.SchemaPath != nil {
		query = query.Where("schema_path = ?", *filter.SchemaPath)
	}
	return query
}
