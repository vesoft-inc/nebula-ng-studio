// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { BrushSelect } from './brush-select';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function pointer(container: HTMLElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, shiftKey: true });
  Object.defineProperties(event, { offsetX: { value: x }, offsetY: { value: y } });
  container.dispatchEvent(event);
}

it('releases the global listener, selection element and callback on repeated destruction', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const runBoxSelect = vi.fn();
  const brush = new BrushSelect({ container, runBoxSelect });
  const remove = vi.spyOn(document, 'removeEventListener');
  pointer(container, 'pointerdown', 10, 20);
  pointer(container, 'pointermove', 40, 60);
  brush.destroy();
  brush.destroy();
  expect(remove).toHaveBeenCalledWith('keyup', brush.pointerup);
  expect(container.children).toHaveLength(0);
  document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
  pointer(container, 'pointerdown', 10, 20);
  pointer(container, 'pointermove', 40, 60);
  pointer(container, 'pointerup', 40, 60);
  expect(runBoxSelect).not.toHaveBeenCalled();
});

it('keeps a replacement brush functional without invoking the destroyed brush', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const first = new BrushSelect({ container, runBoxSelect: vi.fn() });
  const oldCallback = first.runBoxSelect!;
  pointer(container, 'pointerdown', 10, 20);
  pointer(container, 'pointermove', 40, 60);
  first.destroy();
  const callback = vi.fn();
  const next = new BrushSelect({ container, runBoxSelect: callback });
  try {
    pointer(container, 'pointerdown', 10, 20);
    pointer(container, 'pointermove', 40, 60);
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    expect(callback).toHaveBeenCalledWith({ left: 10, top: 20, right: 40, bottom: 60 });
    expect(oldCallback).not.toHaveBeenCalled();
    expect(container.children).toHaveLength(1);
  } finally {
    next.destroy();
  }
});
