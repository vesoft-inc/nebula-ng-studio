// ----
// NOTE: : These imports are necessary to fix TS errors. Do not remove them.
import type {} from '@mui/system';
import type {} from '@emotion/styled';
// ----

import type { Theme as MUITheme } from '@mui/material/styles';
import type { VesoftPalette } from './src/theme';

declare module '@mui/material/styles' {
  interface Theme extends MUITheme {
    palette: VesoftPalette;
  }
}

declare module '*.woff2' {
  const src: string;
  export default src;
}

declare module '*.ttf' {
  const src: string;
  export default src;
}

declare module '*.otf' {
  const src: string;
  export default src;
}
