import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import {
  ExplorerSession,
  ExplorerGraph as InternalExplorerGraph,
  SnapshotList as InternalSnapshotList,
} from '@vesoft-inc/studio-ui-internal/explorer';
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
export interface SnapshotListProps {
  initialSettings?: ExplorerInitialSettings;
  onOpen?: (snapshotId: string) => void;
  className?: string;
  style?: CSSProperties;
}
export interface ExplorerGraphProps {
  initialSettings?: ExplorerInitialSettings;
  snapshotId: string;
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  blocker?: ExplorerNavigationBlocker;
  allowRemoteIconManagement?: boolean;
  className?: string;
  style?: CSSProperties;
}

function useExplorerComponent() {
  const { services } = useStudioScope();
  requireService(services, 'schema');
  requireService(services, 'explorer');
  return useWorkbench('Explorer', { explorer: services.explorer, schema: services.schema }, (scope) => {
    const schema = acquireSchema(scope, services);
    const explorer = scope.acquire('explorer', { explorer: services.explorer }, (lifetime) => ({
      value: bindExplorer(requireService(services, 'explorer'), lifetime),
      dispose: () => {},
    }));
    return {
      ...explorer,
      isCurrent: () => schema.lifetime.active,
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
  });
}

export function SnapshotList({ className, style, initialSettings, onOpen }: SnapshotListProps): ReactElement | null {
  const binding = useExplorerComponent();
  if (!binding.resource) return null;
  return (
    <Resources>
      <WorkbenchContainer className={className} style={style}>
        <ExplorerSession
          services={binding.resource.value.services}
          schemaController={binding.resource.value.schema}
          initialSettings={initialSettings}
        >
          <InternalSnapshotList onOpen={binding.guard(onOpen)} />
        </ExplorerSession>
      </WorkbenchContainer>
    </Resources>
  );
}

export function ExplorerGraph({
  className,
  style,
  initialSettings,
  ...props
}: ExplorerGraphProps): ReactElement | null {
  const dirtyCallback = useRef(props.onDirtyChange);
  dirtyCallback.current = props.onDirtyChange;
  useEffect(() => () => dirtyCallback.current?.(false), []);
  const binding = useExplorerComponent();
  if (!binding.resource) return null;
  return (
    <Resources>
      <WorkbenchContainer className={className} style={style}>
        <ExplorerSession
          services={binding.resource.value.services}
          schemaController={binding.resource.value.schema}
          initialSettings={initialSettings}
        >
          <InternalExplorerGraph
            {...props}
            onBack={binding.guard(props.onBack)}
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
        </ExplorerSession>
      </WorkbenchContainer>
    </Resources>
  );
}
