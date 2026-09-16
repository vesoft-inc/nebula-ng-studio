package common

import (
	"fmt"
	"io"
	"math"
	"reflect"
	"time"

	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	types "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/types"
)

type dataParser struct{}

func (p *dataParser) callProxyMethod(method string, v nebulaTypes.Value) (any, error) {
	ok := isProxyMethod(method)
	if !ok {
		return nil, fmt.Errorf("unknown method: %s", method)
	}

	m := reflect.ValueOf(p).MethodByName(method)
	if !m.IsValid() {
		return nil, fmt.Errorf("invalid method: %s", method)
	}

	ret := m.Call([]reflect.Value{reflect.ValueOf(v)})
	if len(ret) != 2 {
		return nil, fmt.Errorf("method `%s` with invalid return value: %v", method, ret)
	}
	if ret[1].Interface() != nil {
		return nil, ret[1].Interface().(error)
	}
	return ret[0].Interface(), nil
}

func (p *dataParser) NULL(v nebulaTypes.Value) (any, error) {
	return nil, nil
}

func (p *dataParser) BOOL(v nebulaTypes.Value) (any, error) {
	val, err := v.AsBool()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) INT8(v nebulaTypes.Value) (any, error) {
	val, err := v.AsInt8()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) INT16(v nebulaTypes.Value) (any, error) {
	val, err := v.AsInt16()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) INT32(v nebulaTypes.Value) (any, error) {
	val, err := v.AsInt32()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) INT64(v nebulaTypes.Value) (any, error) {
	val, err := v.AsInt64()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) UINT8(v nebulaTypes.Value) (any, error) {
	val, err := v.AsUInt8()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) UINT16(v nebulaTypes.Value) (any, error) {
	val, err := v.AsUInt16()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) UINT32(v nebulaTypes.Value) (any, error) {
	val, err := v.AsUInt32()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) UINT64(v nebulaTypes.Value) (any, error) {
	val, err := v.AsUInt64()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) FLOAT(v nebulaTypes.Value) (any, error) {
	val, err := v.AsFloat()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) DOUBLE(v nebulaTypes.Value) (any, error) {
	val, err := v.AsDouble()
	if err != nil {
		return nil, err
	}
	floatVal := float64(val)
	if math.IsNaN(floatVal) {
		return "NaN.0", nil
	}
	if math.IsInf(floatVal, 1) {
		return "Inf", nil
	}
	if math.IsInf(floatVal, -1) {
		return "-Inf", nil
	}
	return val, nil
}

func (p *dataParser) STRING(v nebulaTypes.Value) (any, error) {
	val, err := v.AsString()
	if err != nil {
		return nil, err
	}
	return val, nil
}

func (p *dataParser) LIST(v nebulaTypes.Value) (any, error) {
	val, err := v.AsList()
	if err != nil {
		return nil, err
	}
	list := make([]any, 0)
	for _, v := range val.GetValues() {
		propType := v.GetType().String()
		propVal, err := p.callProxyMethod(propType, v)
		if err != nil {
			return nil, err
		}
		list = append(list, propVal)
	}
	return list, nil
}

func (p *dataParser) RECORD(v nebulaTypes.Value) (any, error) {
	val, err := v.AsRecord()
	if err != nil {
		return nil, err
	}
	record := make(map[string]any, 0)
	for k, v := range val.GetValues() {
		propType := v.GetType().String()
		propVal, err := p.callProxyMethod(propType, v)
		if err != nil {
			return nil, err
		}
		record[k] = propVal
	}
	return record, nil
}

func (p *dataParser) NODE(v nebulaTypes.Value) (any, error) {
	node, err := v.AsNode()
	if err != nil {
		return nil, err
	}
	props := node.GetProperties()
	parsedProps := make(map[string]any, 0)
	for k, v := range props {
		propType := v.GetType().String()
		propVal, err := p.callProxyMethod(propType, v)
		if err != nil {
			return nil, err
		}
		parsedProps[k] = propVal
	}
	result := types.ElementResult[types.NodeParsed]{
		Raw:  node.String(),
		Type: v.GetType().String(),
		Value: types.NodeParsed{
			Id:         node.GetId(),
			Type:       node.GetType(),
			Labels:     node.GetLabels(),
			Graph:      node.GetGraph(),
			Properties: parsedProps,
		},
	}
	return result, nil
}

func (p *dataParser) EDGE(v nebulaTypes.Value) (any, error) {
	edge, err := v.AsEdge()
	if err != nil {
		return nil, err
	}

	props := edge.GetProperties()
	parsedProps := make(map[string]any, 0)
	for k, v := range props {
		propType := v.GetType().String()
		propVal, err := p.callProxyMethod(propType, v)
		if err != nil {
			return nil, err
		}
		parsedProps[k] = propVal
	}
	result := types.ElementResult[types.EdgeParsed]{
		Raw:  edge.String(),
		Type: v.GetType().String(),
		Value: types.EdgeParsed{
			SrcId:      edge.GetSrcId(),
			DstId:      edge.GetDstId(),
			Labels:     edge.GetLabels(),
			Rank:       edge.GetRank(),
			IsDirected: edge.IsDirected(),
			Type:       edge.GetType(),
			Graph:      edge.GetGraph(),
			Properties: parsedProps,
		},
	}
	return result, nil
}

func (p *dataParser) PATH(v nebulaTypes.Value) (any, error) {
	val, err := v.AsPath()
	if err != nil {
		return nil, err
	}
	paths := make([]any, 0)
	for _, v := range val.GetValues() {
		valType := v.GetType()
		valTypeStr := v.GetType().String()
		val, err := p.callProxyMethod(valTypeStr, v)
		if err != nil {
			return nil, err
		}
		if valType == nebulaTypes.ValueTypeNode {
			eleVal := val.(types.ElementResult[types.NodeParsed])
			paths = append(paths, eleVal.Value)
		} else if valType == nebulaTypes.ValueTypeEdge {
			eleVal := val.(types.ElementResult[types.EdgeParsed])
			paths = append(paths, eleVal.Value)
		} else {
			paths = append(paths, val)
		}
	}
	retult := types.ElementResult[any]{
		Raw:   val.String(),
		Type:  v.GetType().String(),
		Value: paths,
	}
	return retult, nil
}

func (p *dataParser) DURATION(v nebulaTypes.Value) (any, error) {
	val, err := v.AsDuration()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) DATE(v nebulaTypes.Value) (any, error) {
	val, err := v.AsDate()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) LOCALTIME(v nebulaTypes.Value) (any, error) {
	val, err := v.AsLocalTime()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) LOCALDATETIME(v nebulaTypes.Value) (any, error) {
	val, err := v.AsLocalDatetime()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) ZONEDTIME(v nebulaTypes.Value) (any, error) {
	val, err := v.AsZonedTime()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) ZONEDDATETIME(v nebulaTypes.Value) (any, error) {
	val, err := v.AsZonedDatetime()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) Decimal(v nebulaTypes.Value) (any, error) {
	val, err := v.AsDecimal()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) GEOGRAPHY(v nebulaTypes.Value) (any, error) {
	val, err := v.AsGeography()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

func (p *dataParser) EMBEDDINGVECTOR(v nebulaTypes.Value) (any, error) {
	val, err := v.AsEmbeddingVector()
	if err != nil {
		return nil, err
	}
	return val.String(), nil
}

var DataParser = &dataParser{}

func Parser(v nebulaTypes.Result, r *types.ParsedResult) error {
	headers := v.Columns()
	// if len(headers) == 0 {
	// 	return nil
	// }
	r.Headers = headers
	summary := v.Summary()
	r.Summary = types.ResultSummary{
		BuildTimeUs:       time.Duration(summary.BuildTimeUs()),
		OptimizeTimeUs:    time.Duration(summary.OptimizeTimeUs()),
		TotalServerTimeUs: time.Duration(summary.TotalServerTimeUs()),
		SerializeTimeUs:   time.Duration(summary.SerializeTimeUs()),
		ExplainType:       summary.ExplainType(),
		QueryStats: &types.ParsedQueryStats{
			NumAffectedNodes: summary.QueryStats().NumAffectedNodes(),
			NumAffectedEdges: summary.QueryStats().NumAffectedEdges(),
			ExportedRowSize:  summary.QueryStats().ExportedRowSize(),
			ExportedPaths:    summary.QueryStats().ExportedPaths(),
		},
		RowsCount: v.RowSize(),
	}
	for v.HasNext() {
		row, err := v.Next()
		if err != nil {
			// EOF is a normal termination signal, not an error
			// This happens for EXPORT queries and other special cases
			if err == io.EOF {
				break
			}
			return err
		}
		values := row.Values()
		valMap := make(map[string]any, 0)
		for idx, v := range values {
			valueType := v.GetType().String()
			val, err := DataParser.callProxyMethod(valueType, v)
			if err != nil {
				return err
			}
			valMap[headers[idx]] = val
		}
		r.Tables = append(r.Tables, valMap)
	}
	return nil
}
