import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

interface UseResizableReturn {
  height: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  resetHeight: () => void;
}

const DEFAULT_HEIGHT = 456;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 800;

export const useResizable = (options: UseResizableOptions = {}): UseResizableReturn => {
  const { initialHeight = DEFAULT_HEIGHT, minHeight = MIN_HEIGHT, maxHeight = MAX_HEIGHT } = options;

  const [height, setHeight] = useState<number>(initialHeight);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startYRef.current = e.clientY;
      startHeightRef.current = height;
    },
    [height]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaY = startYRef.current - e.clientY;
      const newHeight = startHeightRef.current - deltaY;

      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      setHeight(clampedHeight);
    },
    [isResizing, minHeight, maxHeight]
  );

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
    }
  }, [isResizing]);

  const resetHeight = useCallback(() => {
    setHeight(initialHeight);
  }, [initialHeight]);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    height,
    isResizing,
    handleMouseDown,
    resetHeight,
  };
};
