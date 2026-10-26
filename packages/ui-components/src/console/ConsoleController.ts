import { action, makeObservable, observable } from 'mobx';
import { v4 as uuid } from 'uuid';
import { ConsoleResult, GQLResult, type GQLResultSummary } from '@vesoft-inc/utils';
import type { ConsoleServices, QueryOptions } from '../shared/query';
import type { editor } from 'monaco-editor';
import { GraphItem, GraphTypeElement } from '../schema/types';
import { processGqlStatement } from './gql';
import type { GraphWorkspaceStore } from '../graph/stores/workspace';

/** Reference to the Explorer snapshot created from a Console result. */
export interface ConsoleResultSnapshotRef {
  snapshotId: string;
  /** Graph locked when the snapshot was first created, reused when a deleted snapshot is recreated. */
  graph: string;
}

export default class ConsoleController {
  editorRef?: editor.IStandaloneCodeEditor = undefined;
  editorValue = '';
  editorRunning = false;
  stopping = false;
  private activeRequest?: AbortController;
  private currentSessionId?: string;
  private executionGeneration = 0;
  private metadataRequest = new AbortController();
  private graphListGeneration = 0;
  results = observable.array<ConsoleResult>([], { deep: false });
  graphs: GraphItem[] = [];
  graphWorkspaces = observable.map<string, GraphWorkspaceStore>({}, { deep: false });
  /** One Explorer snapshot per Console result: `result.id` → snapshot reference. Session-scoped. */
  resultSnapshots = observable.map<string, ConsoleResultSnapshotRef>({}, { deep: false });
  editorRowCount = 1;
  graphTypeInfo = observable.map<string, GraphTypeElement[]>({}, { deep: false });

  constructor(public readonly services: ConsoleServices) {
    makeObservable(this, {
      // observable properties
      editorRef: observable.ref,
      editorValue: observable,
      editorRowCount: observable,
      editorRunning: observable,
      stopping: observable,
      results: observable.shallow,
      graphs: observable.shallow,

      // actions
      updateGraphs: action,
      // updateGraphTypes: action,
      updateEditorValue: action,
      updateResults: action,
      addResult: action,
      removeResult: action,
      setEditorRef: action,
      updateEditorRowCount: action,
    });
  }

  updateEditorValue = (value = '') => (this.editorValue = value);
  updateResults = (results: ConsoleResult[]) => this.results.replace(results);
  addResult = (result: ConsoleResult) => this.results.unshift(result);
  removeResult = (result: ConsoleResult) => {
    this.graphWorkspaces.get(result.id)?.destroy();
    this.graphWorkspaces.delete(result.id);
    this.removeResultSnapshot(result.id);
    this.results.remove(result);
  };

  getResultSnapshot = (resultId: string) => this.resultSnapshots.get(resultId);

  setResultSnapshot = (resultId: string, ref: ConsoleResultSnapshotRef) => {
    this.resultSnapshots.set(resultId, ref);
  };

  removeResultSnapshot = (resultId: string) => {
    this.resultSnapshots.delete(resultId);
  };

  /** Purge mappings pointing at a snapshot deleted from Explorer (same-session cleanup). */
  removeResultSnapshotsBySnapshotId = (snapshotId: string) => {
    const staleResultIds = Array.from(this.resultSnapshots.entries())
      .filter(([, ref]) => ref.snapshotId === snapshotId)
      .map(([resultId]) => resultId);
    staleResultIds.forEach((resultId) => this.resultSnapshots.delete(resultId));
  };

  clearResultSnapshots = () => this.resultSnapshots.clear();
  setEditorRef = (ref?: editor.IStandaloneCodeEditor) => {
    this.editorRef = ref;
  };
  updateEditorRowCount = (rowCount: number) => {
    this.editorRowCount = rowCount;
  };

  /**
   * unsafe action, **never make `fn` async**
   * - update observable properties in `fn`
   * ```ts
   * unsafeAction(() => {
   *  this.editorValue = 'new value';
   *  this.results.delete(item);
   * });
   * ```
   * - use `action` to wrap `fn` for batched updates
   * ```ts
   * unsafeAction(() => {
   *  this.updateGraphs(graphs);
   *  this.updateResults(results);
   * });
   * ```
   */
  unsafeAction = (fn: () => void) => action('unsafeAction', fn)();

  /**
   * Placeholder function to process text outside triple-quote blocks
   * Splits text by lines, with backslash continuation support
   * @param outsideText - Text found outside triple-quote blocks
   * @returns Array of processed text sections (one per line, with continuation)
   */
  private processOutsideText(outsideText: string): string[] {
    const trimmed = outsideText.trim();
    if (!trimmed) {
      return [];
    }

    const lines = trimmed.split('\n');
    const sections: string[] = [];
    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Check if line ends with backslash (continuation)
      if (trimmedLine.endsWith('\\')) {
        // Remove the backslash and append to current section
        currentSection += trimmedLine.slice(0, -1).trim() + ' ';
      } else {
        // Complete the current section
        currentSection += trimmedLine;
        if (currentSection) {
          sections.push(currentSection.trim());
        }
        currentSection = '';
      }
    }

    // Handle any remaining section (line ended with backslash but no next line)
    if (currentSection.trim()) {
      sections.push(currentSection.trim());
    }

    return sections;
  }

  /**
   * Parse GQL string into sections based on triple quotes (''' or """)
   * - Content wrapped by ''' or """ will be treated as separate query sections
   * - Text outside triple quotes (head, middle, tail) is processed via processOutsideText
   * - Supports mixing both ''' and """ in the same query
   * - If no triple quote markers exist, returns the entire string as a single section
   */
  private parseGqlSections(gql: string): string[] {
    const sections: string[] = [];
    let remaining = gql;
    let hasTripleQuotes = false;

    while (remaining.length > 0) {
      // Find the first occurrence of either ''' or """
      const singleQuoteIndex = remaining.indexOf("'''");
      const doubleQuoteIndex = remaining.indexOf('"""');

      // No more triple quotes found
      if (singleQuoteIndex === -1 && doubleQuoteIndex === -1) {
        // If no triple quotes were found in the entire string, treat as single section
        if (!hasTripleQuotes) {
          const trimmed = gql.trim();
          return trimmed ? [trimmed] : [];
        }
        // Otherwise, process remaining text as outside text
        const outsideSections = this.processOutsideText(remaining);
        sections.push(...outsideSections);
        break;
      }

      // Mark that we found at least one triple quote block
      hasTripleQuotes = true;

      // Determine which delimiter comes first
      let startIndex: number;
      let delimiter: string;

      if (singleQuoteIndex === -1) {
        startIndex = doubleQuoteIndex;
        delimiter = '"""';
      } else if (doubleQuoteIndex === -1) {
        startIndex = singleQuoteIndex;
        delimiter = "'''";
      } else if (singleQuoteIndex < doubleQuoteIndex) {
        startIndex = singleQuoteIndex;
        delimiter = "'''";
      } else {
        startIndex = doubleQuoteIndex;
        delimiter = '"""';
      }

      // Process text before the triple quote block (head or middle text)
      if (startIndex > 0) {
        const outsideSections = this.processOutsideText(remaining.substring(0, startIndex));
        sections.push(...outsideSections);
      }

      // Find the matching closing delimiter
      const contentStart = startIndex + delimiter.length;
      const endIndex = remaining.indexOf(delimiter, contentStart);

      // No matching closing delimiter found - treat rest as outside text
      if (endIndex === -1) {
        const outsideSections = this.processOutsideText(remaining.substring(startIndex));
        sections.push(...outsideSections);
        break;
      }

      // Extract the section content between delimiters (inside triple quotes)
      const section = remaining.substring(contentStart, endIndex).trim();
      if (section) {
        sections.push(section);
      }

      // Move to the next segment after closing delimiter
      remaining = remaining.substring(endIndex + delimiter.length);
    }

    // If no sections were found, return the entire string as a single section
    return sections.length > 0 ? sections : [gql];
  }

  private getQueryStatsString(summary?: GQLResultSummary) {
    const queryStats = summary?.queryStats;
    if (!queryStats) return '';

    const toNumber = (value: unknown) => {
      const num = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const numAffectedNodes = toNumber(queryStats.numAffectedNodes);
    const numAffectedEdges = toNumber(queryStats.numAffectedEdges);
    const exportedRowSize = toNumber(queryStats.exportedRowSize);
    const exportedPaths = queryStats.exportedPaths || [];

    const lines: string[] = [];

    if (numAffectedNodes > 0) {
      lines.push(`Affected nodes: ${numAffectedNodes}`);
    }

    if (numAffectedEdges > 0) {
      lines.push(`Affected edges: ${numAffectedEdges}`);
    }

    if (Array.isArray(exportedPaths) && exportedPaths.length > 0) {
      lines.push(`Exported rows: ${exportedRowSize}`);
      lines.push('Exported paths:');
      exportedPaths.forEach((path) => {
        lines.push(`  ${path}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Fetch warnings from the server after GQL execution
   */
  private async fetchWarnings(config?: QueryOptions): Promise<{ code?: string; message?: string }[]> {
    try {
      const warningsRes = await this.services.execute<GQLResult<{ code?: string; message?: string }>>(
        'SHOW WARNINGS',
        config
      );
      if (warningsRes.code === 0 && warningsRes.data?.tables?.length) {
        return warningsRes.data.tables;
      }
    } catch {
      // Ignore errors when fetching warnings
    }
    return [];
  }

  /**
   * Execute a single GQL query section
   * @param shouldRecordResult - Whether to record the result in results array
   * @param originalGql - The original full GQL string to record in result
   * @returns Promise<boolean> - true if execution succeeded, false if failed
   */
  private async executeSingleGql(
    trimmedGql: string,
    {
      config,
      shouldRecordResult = false,
      originalGql,
      onAfterExecute,
      interceptConsoleResult,
    }: {
      config?: QueryOptions;
      shouldRecordResult: boolean;
      originalGql?: string;
      onAfterExecute?: (result: import('@vesoft-inc/utils').ServerResponse<GQLResult>) => void | Promise<void>;
      interceptConsoleResult?: (result: ConsoleResult) => ConsoleResult;
    }
  ): Promise<boolean> {
    const processedGql = processGqlStatement(trimmedGql);

    const res = await this.services.execute<GQLResult>(processedGql, config);
    if (config?.signal?.aborted) return false;
    const isSuccess = res.code === 0;
    if (!isSuccess) {
      // 非最后一个语法块执行失败时也需要输出，后续的不执行
      shouldRecordResult = true;
    }

    // Fetch warnings after GQL execution
    await onAfterExecute?.(res);

    if (!config?.signal?.aborted && shouldRecordResult) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      if (config?.signal?.aborted) return false;
      this.unsafeAction(() => {
        const message = (res.message ?? '').replace(/^\w+::/, '');
        const result = {
          ...res,
          message,
          id: uuid(),
          gql: originalGql || trimmedGql,
        } as Omit<ConsoleResult, 'destroy'>;
        const interceptedResult = interceptConsoleResult
          ? interceptConsoleResult({ ...result, destroy: () => undefined })
          : result;
        const finalResult: ConsoleResult = {
          ...interceptedResult,
          destroy: () => this.removeResult(finalResult),
        };
        this.results.unshift(finalResult);
      });
    }

    return isSuccess;
  }

  runGql = async (originalGql: string, config?: QueryOptions) => {
    const trimmedGql = originalGql.trim();
    if (!trimmedGql || this.editorRunning || this.stopping) return;
    const request = new AbortController();
    const generation = ++this.executionGeneration;
    const externalSignal = config?.signal;
    const abort = () => request.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    if (externalSignal?.aborted) request.abort();
    this.activeRequest = request;
    config = { ...config, signal: request.signal };

    // Parse GQL sections (supports multi-query sections wrapped by ''' or """)
    const sections = this.parseGqlSections(trimmedGql);

    this.unsafeAction(() => (this.editorRunning = true));
    try {
      if (this.services.getSessionId && !this.currentSessionId) {
        const sessionId = await this.services.getSessionId({ signal: request.signal });
        if (request.signal.aborted) return;
        this.currentSessionId = sessionId;
      }
      let allSuccess = true;
      const warnings: { code?: string; message?: string }[] = [];
      const queryStats: string[] = [];

      // Execute all sections sequentially, break on first failure
      // Record result for each section individually
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;

        // Check if operation was aborted before executing next section
        if (config?.signal?.aborted) {
          break;
        }

        const isLastSection = i === sections.length - 1;
        const success = await this.executeSingleGql(section, {
          config,
          shouldRecordResult: isLastSection,
          originalGql: trimmedGql,
          onAfterExecute: async (res) => {
            const stats = this.getQueryStatsString(res.data?.summary);
            if (stats) {
              queryStats.push(stats);
            }
            const itemWarnings = await this.fetchWarnings(config);
            warnings.push(...itemWarnings);
          },
          interceptConsoleResult: (result) => {
            return {
              ...result,
              warnings,
              queryStats,
            };
          },
        });

        // Break execution if current section failed
        if (!success) {
          allSuccess = false;
          break;
        }
      }

      // Clear editor only if all sections completed successfully
      if (!config?.signal?.aborted && allSuccess) {
        this.unsafeAction(() => {
          this.updateEditorValue('');
        });
      }
    } catch (err) {
      if (!request.signal.aborted) console.error('error', err);
    } finally {
      externalSignal?.removeEventListener('abort', abort);
      if (generation === this.executionGeneration) {
        this.activeRequest = undefined;
        this.unsafeAction(() => (this.editorRunning = false));
      }
    }
  };

  getGraphs = async () => {
    const signal = this.metadataRequest.signal;
    const generation = ++this.graphListGeneration;
    const gql =
      'call show_graphs() yield name,graph_type,`schema` AS sa, owner return name as "graph",  graph_type, sa as "schema", owner';
    const res = await this.services.query<GQLResult<GraphItem>>(gql, { signal });
    const graphs = (res.data?.tables || []) as GraphItem[];
    if (!signal.aborted && generation === this.graphListGeneration) this.updateGraphs(graphs);
    return graphs;
  };

  updateGraphs = (graphs: GraphItem[]) => {
    this.graphs = graphs;
  };

  clearConsole = () => {
    this.executionGeneration++;
    this.activeRequest?.abort();
    this.activeRequest = undefined;
    this.currentSessionId = undefined;
    this.metadataRequest.abort();
    this.metadataRequest = new AbortController();
    this.graphWorkspaces.forEach((workspace) => workspace.destroy());
    this.graphWorkspaces.clear();
    this.graphTypeInfo.clear();
    this.unsafeAction(() => {
      this.updateEditorValue('');
      this.updateGraphs([]);
      this.results.clear();
      this.clearResultSnapshots();
      this.editorRunning = false;
    });
  };

  cancelQuery = async () => {
    if (this.stopping) return;
    const generation = this.executionGeneration;
    this.unsafeAction(() => {
      this.stopping = true;
    });
    this.activeRequest?.abort();
    try {
      if (this.currentSessionId) await this.services.cancelQuery?.(this.currentSessionId);
    } finally {
      this.unsafeAction(() => {
        this.stopping = false;
        if (generation === this.executionGeneration) this.editorRunning = false;
      });
    }
  };

  destroy = () => {
    this.clearConsole();
    this.setEditorRef(undefined);
  };

  getGraphTypeInfo = async (graphName: string, config?: QueryOptions) => {
    const gql = `CALL describe_graph("${graphName}") yield graph_type_name CALL describe_graph_type(graph_type_name) return *`;
    const res = await this.services.query<GQLResult<GraphTypeElement>>(gql, config);
    return res.data?.tables || [];
  };

  updateGraphTypeMap = async (graphs: string[]) => {
    const signal = this.metadataRequest.signal;
    const graphTypeMap = this.graphTypeInfo;
    for (const graph of graphs) {
      if (!graphTypeMap.has(graph)) {
        const graphType = await this.getGraphTypeInfo(graph, { signal });
        if (signal.aborted) return;
        this.unsafeAction(() => graphTypeMap.set(graph, graphType));
      }
    }
  };
}
