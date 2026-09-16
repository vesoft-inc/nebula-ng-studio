package resultparser

import (
	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	common "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/resultparser/common"
	explain "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/resultparser/explain"
	types "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/types"
)

var parserList = [](func(v nebulaTypes.Result, r *types.ParsedResult) error){
	common.Parser,
	explain.Parser,
}

func Parser(v nebulaTypes.Result, r *types.ParsedResult) error {
	for _, parser := range parserList {
		err := parser(v, r)
		if err != nil {
			return err
		}
	}
	return nil
}
