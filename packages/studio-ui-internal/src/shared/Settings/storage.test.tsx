// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { readStorageSettings, useStorageSettings } from './storage';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

it('keeps settings with the same ID isolated by the host storage key', () => {
  sessionStorage.setItem('app-a', JSON.stringify({ console: { queryTimeout: 10 } }));
  sessionStorage.setItem('app-b', JSON.stringify({ console: { queryTimeout: 20 } }));
  const { result, rerender } = renderHook(
    ({ storageKey }) =>
      useStorageSettings({
        settingId: 'console',
        storageKey,
        storageInstance: sessionStorage,
        defaultSettings: { queryTimeout: 120 },
      }),
    { initialProps: { storageKey: 'app-a' } }
  );
  expect(result.current.settings.queryTimeout).toBe(10);
  rerender({ storageKey: 'app-b' });
  expect(result.current.settings.queryTimeout).toBe(20);
  act(() => result.current.upsertSettings({ queryTimeout: 30 }));
  expect(readStorageSettings('console', { storageKey: 'app-b', storageInstance: sessionStorage })).toEqual({
    queryTimeout: 30,
  });
  expect(readStorageSettings('console', { storageKey: 'app-a', storageInstance: sessionStorage })).toEqual({
    queryTimeout: 10,
  });
});

it('restores defaults when switching to an ID without saved settings', () => {
  sessionStorage.setItem('console-settings', JSON.stringify({ first: { queryTimeout: 10 } }));
  const { result, rerender } = renderHook(
    ({ settingId }) =>
      useStorageSettings({
        settingId,
        storageInstance: sessionStorage,
        defaultSettings: { queryTimeout: 120 },
      }),
    { initialProps: { settingId: 'first' } }
  );
  expect(result.current.settings.queryTimeout).toBe(10);
  rerender({ settingId: 'new-account' });
  expect(result.current.settings.queryTimeout).toBe(120);
});
