const brushCss = {
  position: 'absolute',
  'z-index': 300000,
  border: 'dotted 1px #3e74cc',
  'background-color': 'rgba(255, 255, 255, 0.5)',
  'pointer-events': 'none',
};

const brushCssText = Object.entries(brushCss)
  .reduce((ret, [key, value]) => (ret.push(`${key}:${value};`), ret), [] as string[])
  .join('');

interface BrushSelectProps {
  container: HTMLElement;
  runBoxSelect?(rect: { left: number; top: number; right: number; bottom: number }): void;
}

export class BrushSelect {
  container: BrushSelectProps['container'];
  runBoxSelect: BrushSelectProps['runBoxSelect'];

  selectDom: HTMLDivElement;
  selectStart?: { x: number; y: number };
  selectEnd?: { x: number; y: number };
  isMoving = false;
  isRightSelecting = false;

  constructor({ container, runBoxSelect }: BrushSelectProps) {
    this.container = container;
    this.runBoxSelect = runBoxSelect;
    this.selectDom = document.createElement('div');
    this.container.appendChild(this.selectDom);
    this.#addEventListener();
  }

  #initSelectDom(e: PointerEvent) {
    // this.selectDom.classList.add(styles.graphBoxSelect);
    this.selectDom.style.cssText = brushCssText;
    this.selectDom.style.left = e.offsetX.toString() + 'px';
    this.selectDom.style.top = e.offsetY.toString() + 'px';
  }

  #removeSelectDom() {
    this.selectDom.style.left = -9999 + 'px';
    this.selectDom.style.top = -9999 + 'px';
  }

  #addEventListener() {
    (['pointerdown', 'pointermove', 'pointerup', 'pointerout'] as const).forEach((eventName) => {
      this.container.addEventListener(eventName, this[eventName]);
    });
    document.addEventListener('keyup', this.pointerup);
  }

  pointerdown = (e: PointerEvent) => {
    if (!e.shiftKey && e.button !== 2) {
      return;
    }

    if (e.button === 2) {
      this.isRightSelecting = true;
    }

    e.preventDefault();
    this.#initSelectDom(e);
    this.selectStart = {
      x: e.offsetX,
      y: e.offsetY,
    };
  };

  pointermove = (e: PointerEvent) => {
    if (!this.selectStart && !this.isRightSelecting) {
      return;
    }

    e.preventDefault();
    this.isMoving = true;
    const { x: startX, y: startY } = this.selectStart || { x: 0, y: 0 };
    if (e.offsetX < startX) {
      this.selectDom.style.left = e.offsetX.toString() + 'px';
      this.selectDom.style.width = (startX - e.offsetX).toString() + 'px';
    } else {
      this.selectDom.style.left = startX.toString() + 'px';
      this.selectDom.style.width = (e.offsetX - startX).toString() + 'px';
    }
    if (e.offsetY < startY) {
      this.selectDom.style.top = e.offsetY.toString() + 'px';
      this.selectDom.style.height = (startY - e.offsetY).toString() + 'px';
    } else {
      this.selectDom.style.top = startY.toString() + 'px';
      this.selectDom.style.height = (e.offsetY - startY).toString() + 'px';
    }
    this.selectEnd = { x: e.offsetX, y: e.offsetY };
  };

  pointerup = (e: Event) => {
    this.isRightSelecting = false;
    if (!this.selectDom || !this.isMoving) {
      this.selectStart = undefined;
      this.#removeSelectDom();
      return;
    }

    e.preventDefault();

    const { top, left, width, height } = this.selectDom.style;
    const rect = {
      left: parseInt(left),
      top: parseInt(top),
      right: parseInt(left) + parseInt(width),
      bottom: parseInt(top) + parseInt(height),
    };
    const { x: startX, y: startY } = this.selectStart || { x: 0, y: 0 };
    const { x: endX, y: endY } = this.selectEnd || { x: 0, y: 0 };
    if (endX < startX) {
      rect.left = endX;
      rect.right = startX;
    } else {
      rect.left = startX;
      rect.right = endX;
    }

    if (endY < startY) {
      rect.top = endY;
      rect.bottom = startY;
    } else {
      rect.top = startY;
      rect.bottom = endY;
    }
    this.selectStart = undefined;
    this.isMoving = false;
    this.#removeSelectDom();
    this.runBoxSelect?.(rect);
  };

  pointerout = (e: PointerEvent) => {
    // this.#resetSelectDom();
    if (this.selectDom) {
      e.preventDefault();
      this.isMoving = false;
      this.#removeSelectDom();
    }
  };

  destroy = () => {
    (['pointerdown', 'pointermove', 'pointerup', 'pointerout'] as const).forEach((eventName) => {
      this.container.removeEventListener(eventName, this[eventName]);
    });
    document.removeEventListener('keyup', this.pointerup);
    this.selectDom.remove();
    this.selectStart = undefined;
    this.selectEnd = undefined;
    this.isMoving = false;
    this.isRightSelecting = false;
    this.runBoxSelect = undefined;
  };
}
