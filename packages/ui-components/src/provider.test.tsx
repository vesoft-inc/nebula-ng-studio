// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { UiProvider, useUi } from './provider';
import { ThemeStore } from './theme';

afterEach(() => {
  cleanup();
  localStorage.clear();
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
