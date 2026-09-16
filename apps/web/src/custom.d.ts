import { Theme as MuiTheme } from '@mui/material/styles';
import { VesoftPalette } from '@vesoft-inc/ui-components/theme';

declare module 'd3-force-3d';
declare module '@mui/material/styles' {
  interface Theme extends MuiTheme {
    palette: VesoftPalette;
  }
}

declare module '@vesoft-inc/force-graph' {
  export interface LinkObject {
    id: string;
    [s: string]: unknown;
    source?: string;
    target?: string;
    graphIndex?: number;
    data: EdgeValue;
  }

  export interface NodeObject {
    data: VertexValue;
    id: string;
    x?: number;
    y?: number;
    degree?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
  }
}

declare global {
  interface Window {
    APP_CONFIG?: {
      basePath: string;
      defaultHost: string;
      defaultPort: string;
    };
  }
}
