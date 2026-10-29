// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { observer } from 'mobx-react-lite';
import { UiProvider } from '../provider';
import { ThemeStore } from '../theme';
import { StudioHeader } from './StudioHeader';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('toggles the host theme from light to dark and back through the header', () => {
  const theme = new ThemeStore();
  const Host = observer(() => (
    <UiProvider theme={theme.theme}>
      <StudioHeader logo="Studio" onToggleTheme={theme.toggleMode} />
      <output>{theme.mode}</output>
    </UiProvider>
  ));
  render(<Host />);

  fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
  expect(screen.getByRole('status').textContent).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
  expect(screen.getByRole('status').textContent).toBe('light');
});
