// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { GQLResultPlanInfo, GQLResultSummary } from '@vesoft-inc/studio-core/contracts';
import { usePlanData } from './usePlanData';

function node(id: string, name: string, children: GQLResultPlanInfo[] = []): GQLResultPlanInfo {
  return {
    id,
    name,
    children,
    details: '',
    columns: [],
    timeMs: 10,
    rows: 1,
    memoryKib: 0,
    blockedMs: 0,
    queuedMs: 0,
    consumeMs: 0,
    produceMs: 0,
    finishMs: 0,
    batches: 0,
    concurrency: 1,
    otherStatsJson: '',
  };
}
function freezeTree(plan: GQLResultPlanInfo) {
  plan.children.forEach(freezeTree);
  Object.freeze(plan.children);
  Object.freeze(plan.columns);
  Object.freeze(plan);
}
describe('query protocol and plan presentation', () => {
  it('builds display metadata without modifying raw query results across renders', () => {
    const plan = node('project', 'Project[group]', [node('scan', 'Scan[group]')]);
    const original = JSON.stringify(plan);
    freezeTree(plan);
    const summary: GQLResultSummary = {
      buildTimeUs: 0,
      optimizeTimeUs: 0,
      totalServerTimeUs: 0,
      serializeTimeUs: 0,
      explainType: 'profile',
      rowsCount: 1,
      planInfo: plan,
    };
    const { result, rerender } = renderHook(() => usePlanData(summary));
    const displayed = result.current.nodes.find((item) => item.id === 'scan');
    expect(displayed?.data).toMatchObject({ groupId: 'group', showName: 'Scan', timeMsPercent: 50 });
    expect(result.current.edges).toHaveLength(1);
    rerender();
    expect(result.current.nodes.find((item) => item.id === 'scan')?.data).toMatchObject({
      groupId: 'group',
      showName: 'Scan',
      timeMsPercent: 50,
    });
    expect(JSON.stringify(plan)).toBe(original);
  });
});
