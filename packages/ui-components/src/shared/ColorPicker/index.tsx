import { useEffect, useMemo, useState } from 'react';
import { SketchPicker } from 'react-color';
import { debounce } from 'lodash';
import { COLOR_PICK_LIST } from './colors';

interface ColorPickerProps {
  color?: string;
  onChangeComplete?: (color: string) => void;
}
export default function ColorPicker({ color, onChangeComplete }: ColorPickerProps) {
  const [curColor, setCurColor] = useState(color);
  const onColorChange = useMemo(() => debounce((next: string) => onChangeComplete?.(next), 100), [onChangeComplete]);
  useEffect(() => {
    setCurColor(color);
  }, [color]);
  useEffect(() => () => onColorChange.cancel(), [onColorChange]);
  return (
    <SketchPicker
      disableAlpha
      color={curColor}
      width="300px"
      presetColors={COLOR_PICK_LIST}
      onChange={(next) => {
        setCurColor(next.hex);
        onColorChange(next.hex);
      }}
    />
  );
}
