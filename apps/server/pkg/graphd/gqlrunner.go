package graphd

import (
	"context"
	"time"

	nebulaTypes "github.com/vesoft-inc/nebula-go/v5/pkg/types"
	"github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/resultparser"
	types "github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/graphd/types"
	"github.com/zeromicro/go-zero/core/logx"
)

// RunGqlWithContext executes a GQL query with the provided context
// This allows per-request timeout control via context.WithTimeout
func RunGqlWithContext(ctx context.Context, client nebulaTypes.Client, query string) (*types.ParsedResult, error) {
	start := time.Now()
	resp, err := client.ExecuteContext(ctx, query)
	if err != nil {
		logx.WithContext(ctx).Error("Query execution failed: " + err.Error())
		return nil, err
	}
	duration := time.Since(start)
	result := types.ParsedResult{
		Headers:  make([]string, 0),
		Tables:   make([]map[string]any, 0),
		Duration: time.Duration(duration.Microseconds()),
	}

	err = resultparser.Parser(resp, &result)
	if err != nil {
		logx.WithContext(ctx).Error("Result parsing failed: " + err.Error())
		return nil, err
	}

	return &result, nil
}

// RunGqlWithTimeout executes a GQL query with a specific timeout in seconds
// If timeoutSeconds is 0, uses Execute() directly without context overhead
func RunGqlWithTimeout(client nebulaTypes.Client, query string, timeoutMilliSeconds int) (*types.ParsedResult, error) {
	if timeoutMilliSeconds > 0 {
		ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMilliSeconds)*time.Millisecond)
		defer cancel()
		return RunGqlWithContext(ctx, client, query)
	}

	// No timeout specified, use direct Execute
	start := time.Now()
	resp, err := client.Execute(query)
	if err != nil {
		logx.Error("Query execution failed: " + err.Error())
		return nil, err
	}
	duration := time.Since(start)
	result := types.ParsedResult{
		Headers:  make([]string, 0),
		Tables:   make([]map[string]any, 0),
		Duration: time.Duration(duration.Microseconds()),
	}

	err = resultparser.Parser(resp, &result)
	if err != nil {
		logx.Error("Result parsing failed: " + err.Error())
		return nil, err
	}

	return &result, nil
}

// RunGql executes a GQL query without timeout (backward compatibility)
// Uses Execute() directly for better performance
func RunGql(client nebulaTypes.Client, query string) (*types.ParsedResult, error) {
	return RunGqlWithTimeout(client, query, 0)
}
