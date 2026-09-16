package types

type NodeParsed struct {
	Id         int            `json:"id"`
	Type       string         `json:"type"`
	Labels     []string       `json:"labels"`
	Graph      string         `json:"graph"`
	Properties map[string]any `json:"properties"`
}

type EdgeParsed struct {
	SrcId      int            `json:"srcId"`
	DstId      int            `json:"dstId"`
	Labels     []string       `json:"labels"`
	Properties map[string]any `json:"properties"`
	Rank       int            `json:"rank"`
	Type       string         `json:"type"`
	IsDirected bool           `json:"isDirected"`
	Graph      string         `json:"graph"`
}

type ElementResult[T any] struct {
	Raw   string `json:"raw,omitempty"` // raw string of the element
	Type  string `json:"type"`          // type of the element: NODE/EDGE/PATH...
	Value T      `json:"value"`         // parsed value of the element
}
