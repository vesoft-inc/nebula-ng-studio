import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { ConsoleController, ConsoleWorkbench as InternalConsole } from '@vesoft-inc/studio-ui-internal/console';
import { ensureExplorerSnapshot } from '@vesoft-inc/studio-ui-internal/integrations/console-explorer';
import { useModal } from '@vesoft-inc/studio-ui-internal/modal';
import { useTranslation } from 'react-i18next';
import { mergeAbortSignals } from '@vesoft-inc/studio-core/request';
import { useStudioScope } from './provider';
import { requireService, useWorkbench } from './internal/hooks';
import { bindConsole, bindExplorer } from './internal/adapters';
import { acquireSchema } from './internal/schema';
import { Resources } from './internal/resources';
import { WorkbenchContainer } from './internal/container';
import type { ConsoleSettings } from './services';
import { CONSOLE_DEFAULT_LOCAL_SETTINGS } from '@vesoft-inc/studio-ui-internal/settings';

export type { ConsoleServices, ConsoleSettings, QueryExecutor, QueryOptions } from './services';
export const DEFAULT_CONSOLE_SETTINGS: ConsoleSettings = CONSOLE_DEFAULT_LOCAL_SETTINGS;
export interface SnapshotReference {
  snapshotId: string;
}
export interface ConsoleWorkbenchProps {
  sidebar?: ReactNode;
  emptyState?: ReactNode;
  appearance?: { prompt?: string; showPrompt?: boolean };
  settings?: ConsoleSettings;
  onSettingsChange?: (settings: ConsoleSettings) => void;
  settingsPending?: boolean;
  canOpenSettings?: () => boolean;
  loadGraphMetadata?: boolean;
  /** Enables Console to Explorer handoff; schema and explorer services must be configured. */
  onOpenSnapshot?: (snapshot: SnapshotReference) => void;
  className?: string;
  style?: CSSProperties;
}
export function ConsoleWorkbench({
  onOpenSnapshot,
  className,
  style,
  ...props
}: ConsoleWorkbenchProps): ReactElement | null {
  const { services } = useStudioScope();
  const source = requireService(services, 'console');
  if (onOpenSnapshot) {
    requireService(services, 'schema');
    requireService(services, 'explorer');
  }
  const modal = useModal();
  const { t } = useTranslation('console');
  const binding = useWorkbench('ConsoleWorkbench', { console: source }, (scope) =>
    scope.acquire('console', { console: source }, (lifetime) => {
      const adapted = bindConsole(source, lifetime);
      const controller = new ConsoleController(adapted);
      return {
        value: { controller, services: adapted },
        dispose: controller.destroy,
        schemaChanged: controller.clearConsole,
        snapshotDeleted: controller.removeResultSnapshotsBySnapshotId,
      };
    })
  );
  const resource = binding.resource;
  if (!resource) return null;
  const open = binding.guard(onOpenSnapshot);
  return (
    <Resources>
      <WorkbenchContainer className={className} style={style}>
        <InternalConsole
          {...props}
          controller={resource.value.controller}
          services={resource.value.services}
          onSettingsChange={binding.guard(props.onSettingsChange)}
          onExplore={
            onOpenSnapshot
              ? async (result, graph) => {
                  const schema = acquireSchema(binding.scope, services);
                  const explorer = binding.scope.acquire('explorer', { explorer: services.explorer }, (lifetime) => ({
                    value: bindExplorer(requireService(services, 'explorer'), lifetime),
                    dispose: () => {},
                  }));
                  const pending = mergeAbortSignals(
                    resource.lifetime.signal,
                    schema.lifetime.signal,
                    explorer.lifetime.signal
                  );
                  try {
                    const reference = await ensureExplorerSnapshot({
                      result,
                      graph,
                      consoleController: resource.value.controller,
                      schemaController: schema.value.controller,
                      snapshots: explorer.value.snapshots,
                      snapshotVersion: explorer.value.snapshotVersion,
                      schemaPathFallback: binding.scope.schemaPath,
                      signal: pending.signal,
                    });
                    if (reference && schema.lifetime.active && explorer.lifetime.active) open(reference);
                  } catch (error) {
                    if (
                      binding.isMounted() &&
                      resource.lifetime.active &&
                      schema.lifetime.active &&
                      explorer.lifetime.active
                    )
                      modal.message.error(error instanceof Error && error.message ? error.message : t('exploreFailed'));
                  } finally {
                    pending.dispose();
                  }
                }
              : undefined
          }
        />
      </WorkbenchContainer>
    </Resources>
  );
}
