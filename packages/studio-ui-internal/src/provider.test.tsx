// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createTheme, ThemeProvider, useTheme, type Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { UiProvider, useUi } from './provider';
import { DARK_PALETTE, LIGHT_PALETTE, ThemeStore } from './theme';
import { StudioShell } from './shell/StudioShell';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function ThemeProbe({ onTheme }: { onTheme: (theme: Theme) => void }) {
  onTheme(useTheme());
  return <StudioShell headerProps={{ logo: 'Consumer' }}>Content</StudioShell>;
}

it.each(['light', 'dark'] as const)('supports a standard %s MUI theme without replacing host settings', (mode) => {
  const otherMode = mode === 'light' ? 'dark' : 'light';
  localStorage.setItem('vesoft-theme-mode', JSON.stringify(otherMode));
  const hostTheme = createTheme({
    palette: { mode, primary: { main: '#123456' } },
    typography: { fontFamily: 'HostFont' },
    spacing: 10,
    shape: { borderRadius: 12 },
    components: { MuiButton: { defaultProps: { size: 'small' } } },
  });
  let actualTheme!: Theme;
  render(
    <ThemeProvider theme={createTheme({ palette: { mode: otherMode } })}>
      <UiProvider theme={hostTheme} cssBaseline={false} renderGlobalModal={false}>
        <ThemeProbe onTheme={(theme) => (actualTheme = theme)} />
      </UiProvider>
    </ThemeProvider>
  );

  expect(screen.getByText('Content')).toBeTruthy();
  expect(actualTheme.palette.mode).toBe(mode);
  expect(actualTheme.palette.vesoft).toEqual((mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE).vesoft);
  expect(actualTheme.palette.primary.main).toBe('#123456');
  expect(actualTheme.typography.fontFamily).toBe('HostFont');
  expect(actualTheme.spacing(2)).toBe('20px');
  expect(actualTheme.shape.borderRadius).toBe(12);
  expect(actualTheme.components?.MuiButton?.defaultProps?.size).toBe('small');
  expect(hostTheme.palette.vesoft).toBeUndefined();
});

it('fills missing nested Vesoft colors while preserving host overrides and leaving its theme untouched', () => {
  const hostTheme = createTheme(
    { palette: { mode: 'dark' } },
    { palette: { vesoft: { bgColor: '#123456', v2: { bg1: '#654321' } } } }
  );
  let actualTheme!: Theme;
  render(
    <UiProvider theme={hostTheme} cssBaseline={false} renderGlobalModal={false}>
      <ThemeProbe onTheme={(theme) => (actualTheme = theme)} />
    </UiProvider>
  );

  expect(actualTheme.palette.vesoft.bgColor).toBe('#123456');
  expect(actualTheme.palette.vesoft.v2.bg1).toBe('#654321');
  expect(actualTheme.palette.vesoft.v2.bg2).toBe(DARK_PALETTE.vesoft.v2.bg2);
  expect(hostTheme.palette.vesoft).toEqual({ bgColor: '#123456', v2: { bg1: '#654321' } });
});

it('inherits a standard host theme and follows its mode changes', () => {
  let actualTheme!: Theme;
  const onTheme = (theme: Theme) => (actualTheme = theme);
  const light = createTheme({ palette: { mode: 'light', primary: { main: '#123456' } } });
  const dark = createTheme({ palette: { mode: 'dark', primary: { main: '#654321' } } });
  const view = render(
    <ThemeProvider theme={light}>
      <UiProvider cssBaseline={false} renderGlobalModal={false}>
        <ThemeProbe onTheme={onTheme} />
      </UiProvider>
    </ThemeProvider>
  );
  expect(actualTheme.palette.vesoft).toEqual(LIGHT_PALETTE.vesoft);
  expect(actualTheme.palette.primary.main).toBe('#123456');

  view.rerender(
    <ThemeProvider theme={dark}>
      <UiProvider cssBaseline={false} renderGlobalModal={false}>
        <ThemeProbe onTheme={onTheme} />
      </UiProvider>
    </ThemeProvider>
  );
  expect(actualTheme.palette.mode).toBe('dark');
  expect(actualTheme.palette.vesoft).toEqual(DARK_PALETTE.vesoft);
  expect(actualTheme.palette.primary.main).toBe('#654321');
  expect(light.palette.vesoft).toBeUndefined();
  expect(dark.palette.vesoft).toBeUndefined();
});

it('uses the saved standalone theme mode when no host theme is provided', () => {
  localStorage.setItem('vesoft-theme-mode', JSON.stringify('dark'));
  let actualTheme!: Theme;
  render(
    <UiProvider cssBaseline={false} renderGlobalModal={false}>
      <ThemeProbe onTheme={(theme) => (actualTheme = theme)} />
    </UiProvider>
  );
  expect(actualTheme.palette.mode).toBe('dark');
  expect(actualTheme.palette.vesoft).toEqual(DARK_PALETTE.vesoft);
});

it('isolates locale and modal state while using each host theme', () => {
  const stores = new Map<string, ReturnType<typeof useUi>['modalStore']>();
  function Probe({ id }: { id: string }) {
    const { t } = useTranslation('console');
    const theme = useTheme();
    stores.set(id, useUi().modalStore);
    return (
      <div data-testid={id}>
        {t('run')}:{theme.palette.mode}
      </div>
    );
  }
  const light = new ThemeStore().theme;
  const darkStore = new ThemeStore();
  darkStore.toggleMode('light');
  const view = render(
    <>
      <UiProvider locale="zh_CN" theme={darkStore.theme} cssBaseline={false} renderGlobalModal={false}>
        <Probe id="a" />
      </UiProvider>
      <UiProvider locale="en_US" theme={light} cssBaseline={false} renderGlobalModal={false}>
        <Probe id="b" />
      </UiProvider>
    </>
  );
  expect(view.getByTestId('a').textContent).toBe('运行:dark');
  expect(view.getByTestId('b').textContent).toBe('Run:light');
  expect(stores.get('a')).not.toBe(stores.get('b'));
  view.rerender(
    <>
      <UiProvider locale="en_US" theme={darkStore.theme} cssBaseline={false} renderGlobalModal={false}>
        <Probe id="a" />
      </UiProvider>
      <UiProvider locale="en_US" theme={light} cssBaseline={false} renderGlobalModal={false}>
        <Probe id="b" />
      </UiProvider>
    </>
  );
  expect(view.getByTestId('a').textContent).toBe('Run:dark');
  expect(view.getByTestId('b').textContent).toBe('Run:light');
});
