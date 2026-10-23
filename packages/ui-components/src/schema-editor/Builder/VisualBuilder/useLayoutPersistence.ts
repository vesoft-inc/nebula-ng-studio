import { useEffect, useMemo } from 'react';
import { reaction } from 'mobx';
import type { NodeLayoutMap } from '../../../schema/types';
import type { SchemaLayoutServices } from '../../services';
import { resolveLayoutWrite, retainDraftNodePositions } from './layout';
import type { CanvasStore } from './store';

/** Node drags and force-layout ticks are frequent; coalesce them into one write. */
const SAVE_DEBOUNCE_MS = 800;

interface UseLayoutPersistenceOptions {
  canvas?: CanvasStore;
  /** Only graph-type scoped modes (edit / readonly) persist a layout. */
  enabled: boolean;
  layouts?: SchemaLayoutServices;
  graphTypeName?: string;
  /** Layout restored when the graph type was opened, used to skip no-op writes. */
  initialLayout: NodeLayoutMap | null;
  /** Committed names whose last coordinates survive draft deletion or rename. */
  preserveNodeNames?: string[];
}

/**
 * Remembers the visual builder arrangement so the next visit restores it.
 *
 * Any position change (node drag, force layout run, node added/removed) is
 * debounced and then written for the current graph type. Failures are logged and
 * otherwise ignored: a missing layout must never break the canvas.
 */
export const useLayoutPersistence = ({
  canvas,
  enabled,
  layouts,
  graphTypeName,
  initialLayout,
  preserveNodeNames = [],
}: UseLayoutPersistenceOptions) => {
  const state = useMemo(
    () => ({
      serverSignature: '{}',
      writtenSignature: '',
      queuedWrite: null as { signature: string } | null,
      lastLayout: null as NodeLayoutMap | null,
      rememberedLayout: {} as NodeLayoutMap,
      preservedNames: new Set<string>(),
    }),
    [layouts, graphTypeName]
  );
  const preservedNamesSignature = JSON.stringify(preserveNodeNames);

  useEffect(() => {
    state.serverSignature = JSON.stringify(initialLayout ?? {});
    state.preservedNames = new Set(preserveNodeNames);
    state.rememberedLayout = retainDraftNodePositions(
      {},
      { ...initialLayout, ...state.rememberedLayout },
      state.preservedNames
    );
  }, [state, initialLayout, preservedNamesSignature]);

  useEffect(() => {
    if (!enabled || !canvas || !layouts || !graphTypeName) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const layout = state.lastLayout;
      if (!layout) {
        return;
      }

      const pending = resolveLayoutWrite(layout, {
        serverSignature: state.serverSignature,
        writtenSignature: state.queuedWrite?.signature ?? state.writtenSignature,
      });
      if (!pending) {
        return;
      }

      const queued = { signature: JSON.stringify(pending) };
      state.queuedWrite = queued;
      layouts
        .write(graphTypeName, pending)
        .catch(() => false)
        .then((saved) => {
          if (saved) state.writtenSignature = queued.signature;
          if (state.queuedWrite === queued) state.queuedWrite = null;
        });
    };

    const disposer = reaction(
      () =>
        canvas.nodes.map((node) => `${node.data?.nodeTypeItem?.name}:${node.position.x},${node.position.y}`).join('|'),
      () => {
        const layoutMap = canvas.getCanvasLayout();
        // An empty canvas means the store was just reset; never persist that.
        if (Object.keys(layoutMap).length === 0) {
          return;
        }
        const layout = retainDraftNodePositions(layoutMap, state.rememberedLayout, state.preservedNames);
        state.rememberedLayout = layout;
        state.lastLayout = layout;
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
      },
      { fireImmediately: true }
    );

    return () => {
      disposer();
      flush();
    };
  }, [enabled, state, canvas]);
};
