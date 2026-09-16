package types

import (
	"time"
)

type ResultSummary struct {
	ParseTimeUs       time.Duration     `json:"parseTimeUs"`
	BuildTimeUs       time.Duration     `json:"buildTimeUs"`
	OptimizeTimeUs    time.Duration     `json:"optimizeTimeUs"`
	SerializeTimeUs   time.Duration     `json:"serializeTimeUs"`
	TotalServerTimeUs time.Duration     `json:"totalServerTimeUs"`
	ExplainType       string            `json:"explainType"`
	PlanInfo          *ParsedPlanInfo   `json:"planInfo,omitempty"`
	QueryStats        *ParsedQueryStats `json:"queryStats,omitempty"`
	Log               string            `json:"log"`
	RowsCount         int               `json:"rowsCount"`
}

type ParsedResult struct {
	Headers  []string         `json:"headers"`
	Tables   []map[string]any `json:"tables"`
	Summary  ResultSummary    `json:"summary"`
	Duration time.Duration    `json:"duration"`
}

type ParsedPlanInfo struct {
	Id             string            `json:"id"`
	Name           string            `json:"name"`
	Details        string            `json:"details"`
	Columns        []string          `json:"columns"`
	TimeMs         float64           `json:"timeMs"`
	Rows           int64             `json:"rows"`
	MemoryKib      float64           `json:"memoryKib"`
	BlockedMs      float64           `json:"blockedMs"`
	QueuedMs       float64           `json:"queuedMs"`
	ConsumeMs      float64           `json:"consumeMs"`
	ProduceMs      float64           `json:"produceMs"`
	FinishMs       float64           `json:"finishMs"`
	Batches        int64             `json:"batches"`
	Concurrency    int64             `json:"concurrency"`
	OtherStatsJson []byte            `json:"otherStatsJson"`
	Children       []*ParsedPlanInfo `json:"children"`
}

type ParsedQueryStats struct {
	NumAffectedNodes int64    `json:"numAffectedNodes"`
	NumAffectedEdges int64    `json:"numAffectedEdges"`
	ExportedRowSize  int      `json:"exportedRowSize"`
	ExportedPaths    []string `json:"exportedPaths"`
}
