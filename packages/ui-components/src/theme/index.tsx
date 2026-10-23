import { useMemo } from 'react';
import { type Palette, type ThemeOptions, type Theme, type CssVarsThemeOptions, GlobalStyles } from '@mui/material';
import { deepmerge } from '@mui/utils';
import CssBaseline from '@mui/material/CssBaseline';
import { observable, action, makeObservable, computed } from 'mobx';
import { observer } from 'mobx-react-lite';
import { StyledEngineProvider, ThemeProvider, createTheme } from '@mui/material/styles';

import { DARK_PALETTE, LIGHT_PALETTE, VESOFT_LIGHT_COLOR } from './palette';
import { customizeMuiOutlinedInput, customizeMuiTextField } from './components/Input';
import { customizeMuiButton, customizeMuiIconButton } from './components/button';
import { customizeMuiSelect } from './components/select';
import { customizeMuiChip } from './components/chip';
import { customizeMuiStepConnector, customizeMuiStepLabel } from './components/stepper';
import { LocalStorageUtil } from '@vesoft-inc/utils';
export { renderPasswordIcon } from './styles';
export { DARK_PALETTE, LIGHT_PALETTE, LABEL_COLOR_PICK_LIST, FORCEGRAPH_COLOR_PICK_LIST } from './palette';

const THEME_MODE_KEY = 'vesoft-theme-mode';

export type VesoftColorItem = typeof VESOFT_LIGHT_COLOR;

export const SYSTEM_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export interface VesoftColorPalette extends Omit<Palette, 'getContrastText' | 'augmentColor'> {
  vesoft: VesoftColorItem;
}

export interface VesoftPalette extends Palette {
  vesoft: VesoftColorItem;
}

declare module '@mui/material' {
  interface Theme {
    palette: VesoftPalette;
  }
}

type VesoftThemeOptions = Omit<ThemeOptions, 'components'> &
  Pick<CssVarsThemeOptions, 'defaultColorScheme' | 'colorSchemes' | 'components'> & {
    cssVariables?:
      | boolean
      | Pick<
          CssVarsThemeOptions,
          'colorSchemeSelector' | 'rootSelector' | 'disableCssColorScheme' | 'cssVarPrefix' | 'shouldSkipGeneratingVar'
        >;
  };

export const StyleOverrides = `
:root {
  font-size: 14px;
  font-family: ${SYSTEM_FONT_FAMILY};
}
`;

const DefaultSpacing = 8;
export class ThemeStore {
  mode = 'light';
  customThemeOptions?: Partial<VesoftThemeOptions>;

  constructor(props: { themeOptions?: VesoftThemeOptions } = {}) {
    const savedMode = LocalStorageUtil.getItem<string>(THEME_MODE_KEY);
    if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
      this.mode = savedMode;
    }

    makeObservable(this, {
      mode: observable,
      palette: computed,
      theme: computed,
      customThemeOptions: false,
      toggleMode: action,
    });
    this.customThemeOptions = props.themeOptions;
  }

  get palette() {
    return this.mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  }

  get spacing() {
    return (value: number) => `${DefaultSpacing * value}px`;
  }

  get theme() {
    const palette = this.palette;
    const spacing = this.spacing;
    const customOptions = this.customThemeOptions ?? {};
    const options = deepmerge(
      {
        palette,
        typography: {
          fontFamily: SYSTEM_FONT_FAMILY,
          fontSize: 14,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: () => [StyleOverrides],
          },
          MuiTabs: {
            styleOverrides: {
              root: {
                minHeight: 32,
              },
            },
            variants: [
              {
                props: { textColor: 'primary' },
                style: {
                  color: palette.vesoft.themeColor1,
                },
              },
            ],
          },
          MuiTab: {
            styleOverrides: {
              root: {
                minHeight: 32,
              },
            },
          },
          MuiButton: customizeMuiButton({
            palette,
            spacing,
          }),
          MuiIconButton: customizeMuiIconButton({
            palette,
            spacing,
          }),
          MuiOutlinedInput: customizeMuiOutlinedInput({
            palette,
            spacing,
          }),
          MuiTextField: customizeMuiTextField({
            palette,
          }),
          MuiChip: customizeMuiChip({
            palette,
            spacing,
          }),
          MuiStepConnector: customizeMuiStepConnector({
            palette,
            spacing,
          }),
          MuiStepLabel: customizeMuiStepLabel({
            palette,
            spacing,
          }),
          MuiSelect: customizeMuiSelect(),
          MuiCard: {
            styleOverrides: {
              root: {
                boxShadow: 'none',
                border: `1px solid ${palette.vesoft.v2.border2}`,
              },
            },
          },
          MuiPopover: {
            defaultProps: {
              slotProps: {
                paper: {
                  sx: {
                    borderRadius: 1.5,
                    backgroundColor: (theme: Theme) => theme.palette.vesoft.v2.bg1,
                    boxShadow: '0px 4px 8px 0px rgba(0, 0, 0, 0.10)',
                  },
                },
              },
            },
          },
          MuiTypography: {
            styleOverrides: {
              root: {
                '& span': {
                  lineHeight: 1,
                },
              },
            },
          },
          // MuiButtonGroup: {
          //   variants: [{
          //     props: { variant: 'outlined' },
          //     style: {
          //       '& .MuiButton-root': {
          //         color: palette.vesoft.v2.text2, // 非选中状态的颜色
          //         '&.MuiButton-colorPrimary': {
          //           color: palette.vesoft.v2.text6, // 选中状态的颜色
          //           backgroundColor: palette.vesoft.v2.primary3, // 选中状态的背景色（如果需要）
          //         },
          //         '&:hover': {
          //           backgroundColor: palette.vesoft.v2.primary3, // 悬停状态的背景色（如果需要）
          //         },
          //       },
          //     }
          //   }]
          // }
        },
      } as VesoftThemeOptions,
      customOptions
    );
    return createTheme(options);
  }

  updateThemeOptions = (options: Partial<VesoftThemeOptions>) => {
    this.customThemeOptions = options;
    return this;
  };

  toggleMode = (mode?: string) => {
    const newMode = (mode ?? this.mode) === 'light' ? 'dark' : 'light';
    this.mode = newMode;
    LocalStorageUtil.setItem(THEME_MODE_KEY, newMode);
  };
}

/**
 * Global Theme Store.
 * Used to control the theme of the entire application.
 * Singleton instance for the entire application.
 */
export const themeStore = new ThemeStore();
/**
 * ThemeWrapper
 * @example
 * ```tsx
 * <ThemeWrapper>
 *   <App />
 * </ThemeWrapper>
 *
 * import { themeStore } from '@vesoft-inc/ui-components/theme';
 *
 * themeStore.toggleMode('dark' | 'light');
 * ```
 */
export const ThemeWrapper = observer(function ThemeWrapper({
  tailwindcss,
  interceptTheme,
  children,
}: {
  tailwindcss?: boolean;
  interceptTheme?: (theme: Theme) => Theme;
  children: React.ReactNode;
}) {
  const theme = useMemo(
    () => interceptTheme?.(themeStore.theme) ?? themeStore.theme,
    [interceptTheme, themeStore.theme]
  );
  return (
    <ThemeProvider theme={theme}>
      {tailwindcss ? (
        <StyledEngineProvider enableCssLayer>
          <CssBaseline />
          <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
          {children}
        </StyledEngineProvider>
      ) : (
        <StyledEngineProvider injectFirst>
          <CssBaseline />
          {children}
        </StyledEngineProvider>
      )}
    </ThemeProvider>
  );
});

/**
 * @description Get the color from the Vesoft palette, which can be used in styled-components.
 * @example
 * ```tsx
 * import { styled } from '@mui/material/styles';
 * import Box from '@mui/material/Box';
 * import { getVesoftPaletteColor } from '@vesoft-inc/ui-components/theme';
 *
 * const StyledBox = styled(Box)`
 *   color: ${getVesoftPaletteColor('textColor3')};
 * `;
 * ```
 */
export const getVesoftPaletteColor =
  (key: keyof VesoftColorItem) =>
  ({ theme }: { theme: Theme }) =>
    theme.palette.vesoft[key];

/**
 * @description Get the Vesoft border color, which can be used in styled-components.
 * @example
 * ```tsx
 * import { styled } from '@mui/material/styles';
 * import Box from '@mui/material/Box';
 * import { getVesoftBorder } from '@vesoft-inc/ui-components/theme';
 *
 * const StyledBox = styled(Box)`
 *  border: ${getVesoftBorder};
 *  border-radius: 10px;
 * `;
 * ```
 */
export const getVesoftBorder = ({ theme }: { theme: Theme }) => `${theme.palette.vesoft.textColor6} 1px solid`;
