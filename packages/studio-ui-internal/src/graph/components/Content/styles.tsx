import { css } from '@emotion/css';
export const veEditorBackCls = css`
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 0;
  left: 0;
  top: 0;
`;

const getBackGridSvgDataUrl = (gridColor: string) =>
  `data:image/svg+xml,${encodeURIComponent(`
    <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
      <rect fill="transparent" x="0" y="0" width="20" height="20"/>
      <rect stroke="${gridColor}" stroke-width="1" fill="none" x="2" y="2" width="1" height="1"/>
    </svg>
  `)}`;

export const veEditorBackGridCls = {
  light: css`
    background-image: url(${getBackGridSvgDataUrl('#e0e0e0')});
    background-blend-mode: invert;
  `,
  dark: css`
    background-image: url(${getBackGridSvgDataUrl('#e0e0e01f')});
    background-blend-mode: invert;
  `,
};
