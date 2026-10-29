/// <reference types="vite/client" />
// ----
// NOTE: : These imports are necessary to fix TS errors. Do not remove them.
import type {} from '@mui/system';
import type {} from '@emotion/styled';
// ----

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
