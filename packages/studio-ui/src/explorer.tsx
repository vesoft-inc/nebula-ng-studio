import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { ExplorerWorkbench as InternalExplorer } from '@vesoft-inc/studio-ui-internal/explorer';
import { useStudioScope } from './provider';
import { requireService, useWorkbench } from './internal/hooks';
import { acquireSchema } from './internal/schema';
import { bindExplorer } from './internal/adapters';
import { Resources } from './internal/resources';
import { WorkbenchContainer } from './internal/container';
import type { ExplorerInitialSettings, ExplorerSettings } from './services';
import { EXPLORER_DEFAULT_SETTINGS } from '@vesoft-inc/studio-ui-internal/settings';

export type {
  ExplorerServices,
  SnapshotServices,
  SnapshotCreateInput,
  SnapshotPage,
  ExplorerSettings,
  ExplorerInitialSettings,
  QueryExecutor,
  QueryOptions,
} from './services';
export const DEFAULT_EXPLORER_SETTINGS: ExplorerSettings = EXPLORER_DEFAULT_SETTINGS;
export interface ExplorerNavigationBlocker {
  state: 'unblocked' | 'blocked' | 'proceeding';
  proceed?: () => void;
  reset?: () => void;
}
export interface ExplorerWorkbenchProps {
  initialSettings?: ExplorerInitialSettings;
  snapshotId?: string | null;
  onSnapshotChange?: (id: string | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  blocker?: ExplorerNavigationBlocker;
  allowRemoteIconManagement?: boolean;
  className?: string;
  style?: CSSProperties;
}
export function ExplorerWorkbench({ className, style, ...props }: ExplorerWorkbenchProps): ReactElement | null {
  const dirtyCallback = useRef(props.onDirtyChange);
  dirtyCallback.current = props.onDirtyChange;
  useEffect(() => () => dirtyCallback.current?.(false), []);
  const { services } = useStudioScope();
  requireService(services, 'schema');
  requireService(services, 'explorer');
  const binding = useWorkbench(
    'ExplorerWorkbench',
    { explorer: services.explorer, schema: services.schema },
    (scope) => {
      const schema = acquireSchema(scope, services);
      const explorer = scope.acquire('explorer', { explorer: services.explorer }, (lifetime) => ({
        value: bindExplorer(requireService(services, 'explorer'), lifetime),
        dispose: () => {},
      }));
      return {
        ...explorer,
        value: {
          schema: schema.value.controller,
          services: {
            ...explorer.value,
            onSchemaChanged: (path: string) => {
              if (explorer.lifetime.active) scope.setSchema(path);
            },
            onSnapshotDeleted: (id: string) => {
              if (explorer.lifetime.active) scope.snapshotDeleted(id);
            },
          },
        },
      };
    }
  );
  if (!binding.resource) return null;
  return (
    <Resources>
      <WorkbenchContainer className={className} style={style}>
        <InternalExplorer
          {...props}
          services={binding.resource.value.services}
          schemaController={binding.resource.value.schema}
          onSnapshotChange={binding.guard(props.onSnapshotChange)}
          onDirtyChange={binding.guard(props.onDirtyChange)}
          blocker={
            props.blocker
              ? {
                  ...props.blocker,
                  proceed: binding.guard(props.blocker.proceed),
                  reset: binding.guard(props.blocker.reset),
                }
              : undefined
          }
        />
      </WorkbenchContainer>
    </Resources>
  );
}
