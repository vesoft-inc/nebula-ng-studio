package explain

import (
	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	types "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/types"
)

func parsePlanInfo(planInfo nebulaTypes.PlanInfo) *types.ParsedPlanInfo {
	return &types.ParsedPlanInfo{
		Id:             planInfo.Id(),
		Name:           planInfo.Name(),
		Details:        planInfo.Details(),
		Columns:        planInfo.Columns(),
		TimeMs:         planInfo.TimeMs(),
		Rows:           planInfo.Rows(),
		MemoryKib:      planInfo.MemoryKib(),
		BlockedMs:      planInfo.BlockedMs(),
		QueuedMs:       planInfo.QueuedMs(),
		ConsumeMs:      planInfo.ConsumeMs(),
		ProduceMs:      planInfo.ProduceMs(),
		FinishMs:       planInfo.FinishMs(),
		Batches:        planInfo.Batches(),
		Concurrency:    planInfo.Concurrency(),
		OtherStatsJson: planInfo.OtherStatsJson(),
		Children: func() []*types.ParsedPlanInfo {
			children := planInfo.Children()
			result := make([]*types.ParsedPlanInfo, len(children))
			for i, child := range children {
				result[i] = parsePlanInfo(child)
			}
			return result
		}(),
	}
}

func Parser(v nebulaTypes.Result, r *types.ParsedResult) error {
	summary := v.Summary()
	planInfo := summary.PlanInfo()
	if planInfo != nil && planInfo.Id() != "" {
		r.Summary.PlanInfo = parsePlanInfo(planInfo)
	}
	return nil
}
