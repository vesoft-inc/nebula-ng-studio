import { useEffect, useRef } from 'react';
import { reaction } from 'mobx';
import type { NodeLayoutMap } from '@studio/interfaces';
import { writeGraphTypeLayout } from '@studio/services';
import { resolveLayoutWrite } from './layout';
import { getCanvasLayout, reactFlowNodes } from './store';

/** Node drags and force-layout ticks are frequent; coalesce them into one write. */
const SAVE_DEBOUNCE_MS = 800;

interface UseLayoutPersistenceOptions {
  /** Only graph-type scoped modes (edit / readonly) persist a layout. */
  enabled: boolean;
  address?: string;
  username?: string;
  schemaPath?: string;
  graphTypeName?: string;
  /** Layout restored when the graph type was opened, used to skip no-op writes. */
  initialLayout: NodeLayoutMap | null;
}

/**
 * Remembers the visual builder arrangement so the next visit restores it.
 *
 * Any position change (node drag, force layout run, node added/removed) is
 * debounced and then written for the current graph type. Failures are logged and
 * otherwise ignored: a missing layout must never break the canvas.
 */
export const useLayoutPersistence = ({
  enabled,
  address,
  username,
  schemaPath,
  graphTypeName,
  initialLayout,
}: UseLayoutPersistenceOptions) => {
  const serverSignatureRef = useRef<string>(JSON.stringify(initialLayout ?? {}));
  const writtenSignatureRef = useRef<string>('');
  const pendingLayoutRef = useRef<NodeLayoutMap | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    serverSignatureRef.current = JSON.stringify(initialLayout ?? {});
  }, [initialLayout]);

  useEffect(() => {
    if (!enabled || !address || !username || !graphTypeName) {
      return;
    }

    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const layout = pendingLayoutRef.current;
      pendingLayoutRef.current = null;
      if (!layout) {
        return;
      }

      const pending = resolveLayoutWrite(layout, {
        serverSignature: serverSignatureRef.current,
        writtenSignature: writtenSignatureRef.current,
      });
      if (!pending) {
        return;
      }

      writtenSignatureRef.current = JSON.stringify(pending);
      writeGraphTypeLayout({ address, username, schemaPath, graphTypeName }, pending);
    };

    const disposer = reaction(
      () =>
        reactFlowNodes
          .map((node) => `${node.data?.nodeTypeItem?.name}:${node.position.x},${node.position.y}`)
          .join('|'),
      () => {
        const layout = getCanvasLayout();
        // An empty canvas means the store was just reset; never persist that.
        if (Object.keys(layout).length === 0) {
          return;
        }
        pendingLayoutRef.current = layout;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
      }
    );

    return () => {
      disposer();
      flush();
    };
  }, [enabled, address, username, schemaPath, graphTypeName]);
};
