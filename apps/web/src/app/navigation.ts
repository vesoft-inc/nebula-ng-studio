import { useMatches } from '@tanstack/react-router';
export type NavigationSection = 'console' | 'schema-manager' | 'explorer';
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    section?: NavigationSection;
    schemaSelection?: 'graphs' | 'graph' | 'graph-type';
  }
}
export function useNavigationSection(): NavigationSection {
  return useMatches({
    select: (matches) =>
      [...matches].reverse().find((match) => match.staticData.section)?.staticData.section ?? 'console',
  });
}
