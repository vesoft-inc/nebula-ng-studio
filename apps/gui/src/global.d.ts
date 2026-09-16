/// <reference types="vite/client" />
import { Theme as MuiTheme } from '@mui/material/styles';
import { VesoftPalette } from '@vesoft-inc/ui-components/theme';

declare module '@mui/material/styles' {
  interface Theme extends MuiTheme {
    palette: VesoftPalette;
  }
}

/*
declare global {
  interface Window {
    APP_CONFIG?: {
      basePath: string;
    };
  }
}
*/

declare module '*.svg?url' {
  const content: string;
  export default content;
}
