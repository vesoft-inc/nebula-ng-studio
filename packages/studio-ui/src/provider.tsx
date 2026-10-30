import { createContext, useContext, useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import type { Theme } from '@mui/material/styles';
import type { i18n } from 'i18next';
import { UiProvider as InternalUiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import type { StudioServices } from './services';
import { StudioScope } from './internal/scope';

export interface UiProviderProps {
  children: ReactNode;
  theme?: Theme;
  i18n?: i18n;
  locale?: string;
  /** Defaults to false when embedding into a host application. */
  cssBaseline?: boolean;
}
export function UiProvider({ cssBaseline = false, ...props }: UiProviderProps): ReactElement {
  return <InternalUiProvider {...props} cssBaseline={cssBaseline} />;
}
export interface StudioProviderProps extends UiProviderProps {
  /**
   * Opaque user, database and connection-session identity. Change it when that identity changes,
   * not for ordinary route or theme updates; a change disposes the previous scope.
   */
  scopeKey: string;
  /** Host adapters bound to this identity. Keep individual domain objects stable to retain their state. */
  services: StudioServices;
  /**
   * Schema already selected in the host's remote session. Updating this prop synchronizes UI state;
   * it does not perform a remote schema switch on the host's behalf.
   */
  schemaPath?: string;
  /** Reflect a schema switch successfully completed inside a workbench in the host's schemaPath state. */
  onSchemaChange?: (path: string) => void;
}
interface ScopeContextValue {
  scope: StudioScope;
  services: StudioServices;
}
const ScopeContext = createContext<ScopeContextValue | null>(null);
export function useStudioScope() {
  const context = useContext(ScopeContext);
  if (!context) throw new Error('StudioProvider is required for Studio workbenches.');
  return context;
}
function ScopeProvider({
  services,
  schemaPath,
  onSchemaChange,
  children,
  ...ui
}: Omit<StudioProviderProps, 'scopeKey'>) {
  const [scope] = useState(() => new StudioScope(services, schemaPath));
  useLayoutEffect(() => {
    scope.activate();
    return () => scope.deactivate();
  }, [scope]);
  useLayoutEffect(() => {
    scope.onSchemaChange = onSchemaChange;
    scope.configure(services, schemaPath);
  }, [scope, services, schemaPath, onSchemaChange]);
  return (
    <ScopeContext.Provider value={{ scope, services }}>
      <UiProvider {...ui}>{children}</UiProvider>
    </ScopeContext.Provider>
  );
}
export function StudioProvider({ scopeKey, ...props }: StudioProviderProps): ReactElement {
  return <ScopeProvider key={scopeKey} {...props} />;
}
